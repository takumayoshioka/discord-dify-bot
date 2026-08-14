import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Routes,
} from "discord.js"

import { env } from "#src/env"
import {
  translationBotLogin,
  translationBotTransferMessage,
  translateMessageCommand,
  translationBotReplyCommand,
  transaltionBotReplyByEmoji,
} from "#src/translation/bot"
import {
  connectCommand,
  disconnectCommand,
  botConnectionCommandsInteraction,
  showTargetCommand,
  showAllCommand,
  resetChDBCommand,
  resetMsgDBCommand,
} from "#src/translation/slashCommands"
import { dajareBotLogin, dajareBotReply } from "#src/dajare/bot"
import { botDajareCommandsInteraction, removeCommand, resetDajareDBCommand, setCommand, showSetCommand } from "#src/dajare/slashCommands"
import { connectDB, dajareDB, messageDB } from "#src/db/manager"

await connectDB.init()
await dajareDB.init()
await messageDB.init()

const translationClient: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks
  ],
  partials: [
    Partials.Message,
    Partials.Reaction
  ]
})

const dajareClient: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
})

// translation bot
translationClient.once(Events.ClientReady, translationBotLogin)
translationClient.on(Events.MessageCreate, translationBotTransferMessage(translationClient))
translationClient.on(Events.InteractionCreate, translationBotReplyCommand)
translationClient.on(Events.MessageReactionAdd, transaltionBotReplyByEmoji)

// slash commands for translation
translationClient.on(Events.InteractionCreate, botConnectionCommandsInteraction)
const translationCommands = [
  translateMessageCommand,
  connectCommand,
  disconnectCommand,
  showTargetCommand,
  showAllCommand,
  resetChDBCommand,
  resetMsgDBCommand
].map((command) => command.toJSON())

// dajare bot
dajareClient.once(Events.ClientReady, dajareBotLogin)
dajareClient.on(Events.MessageCreate, dajareBotReply)

// slash commands
dajareClient.on(Events.InteractionCreate, botDajareCommandsInteraction)
const dajareCommands = [
  setCommand,
  removeCommand,
  showSetCommand,
  resetDajareDBCommand
].map((command) => command.toJSON())

// login
await translationClient.login(env.DISCORD_TOKEN_TRANS)
await dajareClient.login(env.DISCORD_TOKEN_DAJARE)

// set slash command
await translationClient.rest.put(
  Routes.applicationGuildCommands(
    env.DISCORD_APP_ID_TRANS, env.DISCORD_GUILD_ID),
  { body: translationCommands }
)

await dajareClient.rest.put(
  Routes.applicationGuildCommands(
    env.DISCORD_APP_ID_DAJARE, env.DISCORD_GUILD_ID),
  { body: dajareCommands }
)