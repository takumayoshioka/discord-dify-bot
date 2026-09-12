import {
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  Webhook,
  type Channel,
  type Interaction,
  type OmitPartialGroupDMChannel,
  type Snowflake,
  type MessageReaction,
  type PartialMessageReaction,
  type User,
  type PartialUser,
  Events,
} from "discord.js"

import {
  JsonResultError,
  parseAttachmentFiles
} from "#src/util/jsonFormat"
import {
  difyRequest,
  type DifyResult,
} from "#src/util/difyURL"
import {
  connectDB,
  messageDB,
  type TranslationDirection
} from "#src/db/manager"
import { CoreBot } from "#src/util/bot"
import { botConnectionCommandsInteraction, commands } from "./commands.js"
import { difyErrorToMessageError, type MessageErrorReport } from "#src/util/messageError"

const isTextChannel = (channel: Channel): channel is TextChannel => {
  return channel instanceof TextChannel
}

// return an additional prompt 
const getAdditionalPrompt = (dir: TranslationDirection) => {
  return (() => {
    switch (dir) {
      case "ja-to-en":
        return "翻訳先言語：英語"
      case "en-to-ja":
        return "翻訳先言語：日本語"
    }
  })() + "\n翻訳するテキストは以下の通りです。\n"
}

const translate = async (message: string, dir: TranslationDirection) => {
  return await difyRequest(
    "translation", getAdditionalPrompt(dir) + message
  )
}

// webhooks cache
const mapWebhooks = new Map<Snowflake, Webhook>()
const botWebhookName: string = "Webhook: Translator Bot"

const getWebhook = async (channel: TextChannel) => {
  const webhook = mapWebhooks.get(channel.id) ??
    await generateWebhook(channel)

  return webhook
}

const generateWebhook = async (channel: TextChannel) => {
  const webhooks = await channel.fetchWebhooks()

  const webhook = webhooks?.find((v) =>
    v.owner?.id === channel.client.user.id &&
    v.name === botWebhookName
  ) ??
    await channel.createWebhook({ name: botWebhookName })

  mapWebhooks.set(channel.id, webhook)
  return webhook
}

// collects channel IDs that has non-sent messages 
const waitingChannelIDs = new Set<string>()

// send translated messages from message database
// waitingChannelIDs must have targetChannel.id in this function
const sendTranslatedContentBody = async (targetChannel: TextChannel) => {
  const row = await messageDB.getTranslatedContent(targetChannel.id)

  if (!row) {
    waitingChannelIDs.delete(targetChannel.id)
    return
  }
  if (!(row.translated_content) && row.translated_content !== "") {
    waitingChannelIDs.delete(targetChannel.id)
    return
  }

  const webhook = await getWebhook(targetChannel)
  const files = parseAttachmentFiles(row.attachment_json)
  switch (files.status) {
    case ("Success"): {
      await webhook.send({
        content: row.translated_content,
        files: files.result,
        username: row.display_name,
        avatarURL: row.avatar_url,
      })

      await messageDB.dequeue(row.id)
      await sendTranslatedContentBody(targetChannel)
      break
    }

    case ("Failure"): {
      await messageDB.dequeue(row.id)
      throw new JsonResultError("Parsing Json Attachment", files.errorReport)
    }
  }
}

const sendTranslatedContent = async (targetChannel: TextChannel) => {
  if (waitingChannelIDs.has(targetChannel.id)) {
    return
  } else {
    waitingChannelIDs.add(targetChannel.id)
    await sendTranslatedContentBody(targetChannel)
  }
}

export class TranslationBot extends CoreBot<MessageErrorReport> {
  setEventHandlers = () => {
    this.client.once(Events.ClientReady, this.wrapper(this.login))
    this.client.on(Events.MessageCreate, this.wrapper(this.transferMessage))
    this.client.on(Events.InteractionCreate, this.wrapper(this.replyCommand))
    this.client.on(Events.MessageReactionAdd, this.wrapper(this.replyByEmoji))
    this.client.on(Events.InteractionCreate, this.wrapper(botConnectionCommandsInteraction))
  }

  commands = commands

  protected errorReportToMessage = (report: MessageErrorReport) => {
    const raw = (report.raw === undefined)
      ? "" : `\n\`\`\`\n${report.raw}\n\`\`\``
    return `${report.name}: ${report.message}\nChannel: <#${report.channelID}>\nMessage Link: ${report.url}${raw}`
  }

  // login
  protected loginCallback = async () => {
    if (!this.client.user) { return }

    // check bot permission
    const isPermission = this.client.guilds.cache.reduce(
      // this bot must have ManageWebhook permission
      (acc, guild) => {
        const botMember = guild.members.me
        if (!botMember) { return false }

        return acc
          && botMember.permissions.has(PermissionFlagsBits.ManageWebhooks)
      },
      true
    )

    if (isPermission) {
      await messageDB.reset()
    } else {
      console.error(
        `User ${this.client.user.tag} does not have ManageWebhook permission`
      )
      await this.logout()
    }
  }

  // translate messages sent only in TextChannel
  protected transferMessage = async (
    message: OmitPartialGroupDMChannel<Message<boolean>>
  ) => {
    // ignore messages from bot or post through webhook 
    if (message.author.bot || message.webhookId) { return }

    // get the target channel to which this bot sends a translation result
    const target = await connectDB.getTargetChannel(message.channelId)
    if (target === undefined) { return }

    const targetChannel =
      await this.client.channels.cache.get(target.channelID) ??
      await this.client.channels.fetch(target.channelID)

    // reject non-TextChannel
    if (!isTextChannel(targetChannel!)) { return }

    await this.updateTimestamp(message.createdTimestamp)

    const content = message.content
    const attachedFiles = [...message.attachments.values()]
      .map((attachment) => ({
        attachment: attachment.url,
        name: attachment.name
      }))

    // does not send empty message
    if (content.length === 0 && attachedFiles.length === 0) {
      return
    }

    // sending with copying author
    const displayName =
      message.member?.displayName ??
      message.author.displayName
    const avatarURL =
      message.member?.displayAvatarURL() ??
      message.author.displayAvatarURL()

    const rowID = await messageDB.enqueue(
      target.channelID,
      content,
      JSON.stringify(attachedFiles),
      displayName,
      avatarURL
    )

    if (!rowID) { return }

    // gets translation result
    // does not translate it if it is empty
    const translatedRes: DifyResult = (content.length === 0)
      ? { status: "Success", result: content }
      : await translate(content, target.direction)

    switch (translatedRes.status) {
      case ("Success"): {
        await messageDB.setTranslatedContent(rowID, translatedRes.result)
        await sendTranslatedContent(targetChannel)
        break
      }

      case ("Failure"): {
        await this.portErrorReport({
          ...translatedRes.errorReport,
          channelID: message.channelId,
          url: message.url
        })
        break
      }
    }
  }

  // translate messages if it selected by context menu
  protected replyCommand = async (
    interaction: Interaction
  ) => {
    if (!interaction.isMessageContextMenuCommand()) { return }

    const message = interaction.targetMessage
    if (message.content.length === 0) { return }

    const commandName = interaction.commandName
    const dir: TranslationDirection | undefined =
      (commandName === "ja-to-en") ? "ja-to-en"
        : (commandName === "en-to-ja") ? "en-to-ja" : undefined
    if (dir === undefined) { return }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    })

    await this.updateTimestamp(interaction.createdTimestamp)

    const translatedRes = await translate(message.content, dir)
    switch (translatedRes.status) {
      case ("Success"): {
        await interaction.editReply(translatedRes.result)
        break
      }

      case ("Failure"): {
        await this.portErrorReport(
          difyErrorToMessageError(translatedRes.errorReport, message))
        await interaction.deleteReply()
        break
      }
    }
  }

  // transate messages, if it has been reacted by specific emoji
  protected replyByEmoji = async (
    reaction: MessageReaction | PartialMessageReaction,
    _user: User | PartialUser) => {
    if (reaction.partial) { reaction = await reaction.fetch() }

    const translationDirection =
      (reaction.emoji.name === "\u{1F1EF}\u{1F1F5}")
        ? "en-to-ja"
        : (
          reaction.emoji.name === "\u{1F1EC}\u{1F1E7}" ||
          reaction.emoji.name === "\u{1F1FA}\u{1F1F8}"
        ) ? "ja-to-en" : undefined
    if (translationDirection === undefined) { return }

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message

    if (message.content.length === 0) { return }

    const targetChannel = message.channel
    if (!targetChannel.isSendable()) { return }

    await this.updateTimestamp(Date.now())

    // get translation result
    const translatedRes = await translate(message.content, translationDirection)

    switch (translatedRes.status) {
      case ("Success"): {
        await targetChannel.send({
          content: translatedRes.result,
          reply: {
            messageReference: message.id,
            failIfNotExists: false
          },
          allowedMentions: {
            repliedUser: false
          },
        })
        break
      }

      case ("Failure"): {
        await this.portErrorReport(
          difyErrorToMessageError(translatedRes.errorReport, message))
        break
      }
    }
  }
}
