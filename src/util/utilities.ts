import type { Attachment, Collection } from "discord.js"

export const sleep = async (ms: number) => {
  await new Promise(res => setTimeout(res, ms))
}

export const detachVoidPromise = <Args extends unknown[]>(
  callback: (...args: Args) => Promise<void>
) => {
  return (...args: Args) => {
    callback(...args).catch((err) => { console.error(err) })
  }
}

export const arrayAttachments = (
  attachments: Collection<string, Attachment>
) => {
  return [...attachments.values()]
    .map((attachment) => ({
      attachment: attachment.url,
      name: attachment.name
    }))
}