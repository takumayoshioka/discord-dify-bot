import {
  Message,
  TextChannel,
  Events,
  type Channel,
  type OmitPartialGroupDMChannel,
} from "discord.js"

import {
  difyRequest,
} from "#src/util/difyURL"
import {
  dajareDB
} from "#src/db/manager"
import { CoreBot } from "#src/util/bot"
import { botDajareCommandsInteraction, commands } from "#src/dajare/commands"
import { type MessageErrorReport, difyErrorToMessageError } from "#src/util/messageError"

const NOT_DAJARE = "NO"

const isTextChannel = (channel: Channel): channel is TextChannel => {
  return channel instanceof TextChannel
}

const evaluate = async (message: string) => {
  return await difyRequest("dajare", message)
}

export class DajareBot extends CoreBot<MessageErrorReport> {
  setEventHandlers = () => {
    this.client.once(Events.ClientReady, this.login)
    this.client.on(Events.MessageCreate, this.dajareBotReply)
    this.client.on(Events.InteractionCreate, botDajareCommandsInteraction)
  }

  commands = commands

  errorReportToMessage = (report: MessageErrorReport) => {
    const raw = (report.raw === undefined)
      ? "" : `\n\`\`\`text\n${report.raw}\n\`\`\``
    return `${report.name}: ${report.message}\nChannel: <#${report.channelID}>\nMessage Link: ${report.url}${raw}`
  }

  loginCallback = async () => { }

  dajareBotReply = async (
    message: OmitPartialGroupDMChannel<Message<boolean>>
  ) => {
    // ignore messages from bot or post through webhook 
    if (message.author.bot || message.webhookId) { return }

    // get the target channel to which this bot sends a translation result
    const target = await dajareDB.checkTarget(message.channelId)
    if (!target) { return }
    const targetChannel = message.channel

    // reject non-TextChannel
    if (!isTextChannel(targetChannel)) { return }

    const content = message.content

    // does not send empty request
    if (content.length === 0) { return }

    // get evaluation result
    const evaluateRes = await evaluate(content)

    switch (evaluateRes.status) {
      case ("Success"): {
        const res = evaluateRes.result
        // do not send empty message
        if (res.length === 0) { return }

        if (res === NOT_DAJARE) {
          message.react("❌")
          return
        }

        await message.reply({
          content: res,
          allowedMentions: { repliedUser: false }
        })

        break
      }

      case ("Failure"): {
        await this.portErrorReport(
          difyErrorToMessageError(evaluateRes.errorReport, message))
        break
      }
    }
  }
}