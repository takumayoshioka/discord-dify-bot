import {
  Client,
  Message,
  TextChannel,
  type Channel,
  type OmitPartialGroupDMChannel,
} from "discord.js"

import {
  difyRequest
} from "#src/dify/difyURL"
import {
  dajareDB
} from "#src/db/manager"

const NOT_DAJARE = "NO"

const isTextChannel = (channel: Channel): channel is TextChannel => {
  return channel instanceof TextChannel
}

const evaluate = async (message: string) => {
  return await difyRequest("dajare", message)
}

// login 
export const dajareBotLogin = async (client: Client<true>) => {
  console.log(`Ready! Logged in as ${client.user.tag}`)
}

// translate messages sent only in TextChannel
export const dajareBotReply = async (
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

  // do not send empty message
  if (evaluateRes === NOT_DAJARE || evaluateRes.length === 0) { return }

  await message.reply(evaluateRes)
}