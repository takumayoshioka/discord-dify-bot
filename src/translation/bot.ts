import {
  ApplicationCommandType,
  Client,
  ContextMenuCommandBuilder,
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
} from "discord.js"

import {
  parseAttachmentFiles,
} from "#src/dify/jsonFormat"
import {
  difyRequest
} from "#src/dify/difyURL"
import {
  connectDB,
  messageDB,
  type TranslationDirection,
  NotTargetChannel
} from "#src/db/manager"

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
  await webhook.send({
    content: row.translated_content,
    files: parseAttachmentFiles(row.attachment_json),
    username: row.display_name,
    avatarURL: row.avatar_url,
  })

  await messageDB.dequeue(row.id)
  await sendTranslatedContentBody(targetChannel)
}

const sendTranslatedContent = async (targetChannel: TextChannel) => {
  if (waitingChannelIDs.has(targetChannel.id)) {
    return
  } else {
    waitingChannelIDs.add(targetChannel.id)
    await sendTranslatedContentBody(targetChannel)
  }
}

// login 
export const translationBotLogin = async (client: Client<true>) => {
  // check bot permission
  const isPermission = client.guilds.cache.reduce(
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
    console.log(`Ready! Logged in as ${client.user.tag}`)
    await messageDB.reset()
  } else {
    console.error(
      `User ${client.user.tag} does not have ManageWebhook permission`
    )
    await client.destroy()
  }
}

// translate messages sent only in TextChannel
export const translationBotTransferMessage = (client: Client<boolean>) => async (
  message: OmitPartialGroupDMChannel<Message<boolean>>
) => {
  // ignore messages from bot or post through webhook 
  if (message.author.bot || message.webhookId) { return }

  try {
    // get the target channel to which this bot sends a translation result
    const target = await connectDB.getTargetChannel(message.channelId)
    const targetChannel = await client.channels.fetch(target.channelID)

    // reject non-TextChannel
    if (!isTextChannel(targetChannel!)) { return }

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

    // get translation result
    // do not translate it if it is empty
    const translatedRes = (content.length === 0)
      ? content
      : await translate(content, target.direction)

    await messageDB.setTranslatedContent(rowID, translatedRes)
    await sendTranslatedContent(targetChannel)
  } catch (err) {
    if (err instanceof NotTargetChannel) { return }
    console.error("Failed to forward message: \n", err)
  }
}

// build a translate command in context menu
export const translateMessageCommand = new ContextMenuCommandBuilder()
  .setName("translate")
  .setType(ApplicationCommandType.Message)

// translate messages if it selected by context menu
export const translationBotReplyCommand = async (
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

  const translatedRes = await translate(message.content, dir)
  await interaction.editReply(translatedRes)
}

// transate messages, if it has been reacted by specific emoji
export const transaltionBotReplyByEmoji = async (
  reaction: MessageReaction | PartialMessageReaction,
  _user: User | PartialUser) => {
  if (reaction.partial) { await reaction.fetch() }

  const translationDirection: TranslationDirection | null =
    (reaction.emoji.name === "\u{1F1EF}\u{1F1F5}")
      ? "en-to-ja"
      : (
        reaction.emoji.name === "\u{1F1EC}\u{1F1E7}" ||
        reaction.emoji.name === "\u{1F1FA}\u{1F1F8}"
      ) ? "ja-to-en" : null
  if (!translationDirection) { return }

  const message = reaction.message.partial
    ? await reaction.message.fetch()
    : reaction.message

  if (message.content.length === 0) { return }

  const targetChannel = message.channel
  if (!targetChannel.isSendable()) { return }

  // get translation result
  const translatedRes = await translate(message.content, translationDirection)

  await targetChannel.send({
    content: translatedRes,
    reply: {
      messageReference: message.id,
      failIfNotExists: false
    },
    allowedMentions: {
      repliedUser: false
    },
  })
}
