import {
  Message,
  TextChannel,
  Events,
  type Channel,
  type OmitPartialGroupDMChannel,
} from "discord.js"

import {
  difyRequest,
  type DifyKind,
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
    this.client.once(Events.ClientReady, this.wrapper(this.login))
    this.client.on(Events.MessageCreate, this.wrapper(this.dajareBotReply))
    this.client.on(Events.InteractionCreate, this.wrapper(botDajareCommandsInteraction))
  }

  commands = commands
  protected kind: DifyKind = "dajare"

  errorReportToMessage = (report: MessageErrorReport) => {
    const raw = (report.raw === undefined)
      ? "" : `\n\`\`\`\n${report.raw}\n\`\`\``
    return `${report.name}: ${report.message}\nChannel: <#${report.channelID}>\nMessage Link: ${report.url}${raw}`
  }

  loginCallback = async () => { }

  private notify = async (msg: string) => {
    const channelID = await dajareDB.getFirst()
    if (channelID === undefined) { return }

    const ch =
      await this.client.channels.cache.get(channelID) ??
      await this.client.channels.fetch(channelID)

    if (!isTextChannel(ch!)) { return }

    await ch.send(msg)
  }

  protected leave = async () => {
    await this.notify("ごめんなさい、仕事が立て込んでしまいました。しばらく休ませてください。")
  }

  protected recover = async () => {
    await this.notify("ただいま戻りました。")
  }

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

    await this.updateTimestamp(message.createdTimestamp)

    // get evaluation result
    const evaluateRes = await evaluate(content)

    switch (evaluateRes.status) {
      case ("Success"): {
        const res = evaluateRes.result
        // do not send empty message
        if (res.length === 0) { return }
        if (res === NOT_DAJARE) { return }

        await message.reply({
          content: res,
          allowedMentions: { repliedUser: false }
        })

        break
      }

      case ("Failure"): {
        if (evaluateRes.errorReport.name === "RETRY") {
          this.retryTimestamp(message.createdTimestamp)
          const retryEvaluateRes = await evaluate(content)
          switch (retryEvaluateRes.status) {
            case ("Success"): {
              const res = retryEvaluateRes.result
              // do not send empty message
              if (res.length === 0) { return }
              if (res === NOT_DAJARE) { return }

              await message.reply({
                content: res,
                allowedMentions: { repliedUser: false }
              })
              break
            }

            case ("Failure"): {
              this.retry()
              break
            }
          }
        }
        await this.portErrorReport(
          difyErrorToMessageError(evaluateRes.errorReport, message))
        break
      }
    }
  }
}