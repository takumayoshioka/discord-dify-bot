import type { ErrorReport } from "#src/util/result"
import type { DifyErrorReport } from "#src/util/difyURL"
import type { Message } from "discord.js"

export type MessageErrorReportBase<T extends ErrorReport> = T & {
  channelID: string,
  url: string
}

export type MessageErrorReport = MessageErrorReportBase<DifyErrorReport>
export const difyErrorToMessageError = (
  report: DifyErrorReport,
  message: Message
): MessageErrorReport => {
  return {
    ...report,
    channelID: message.channelId,
    url: message.url
  }
}