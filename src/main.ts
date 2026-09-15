import {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
} from "discord.js"

import { env } from "#src/env"
import { TranslationBot } from "#src/translation/bot"
import { DajareBot } from "#src/dajare/bot"
import {
  connectDB,
  dajareDB,
  errorDB,
  messageDB
} from "#src/db/manager"
import { botSetup } from "#src/util/bot"

await connectDB.init()
await dajareDB.init()
await messageDB.init()
await errorDB.init()

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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ]
})

const bots = botSetup({
  translation: { BotClass: TranslationBot, client: translationClient },
  dajare: { BotClass: DajareBot, client: dajareClient },
})

bots.translation.init()
bots.dajare.init()

// login
await translationClient.login(env.DISCORD_TOKEN_TRANS)
await dajareClient.login(env.DISCORD_TOKEN_DAJARE)

// set slash command
await translationClient.rest.put(
  Routes.applicationGuildCommands(
    env.DISCORD_APP_ID_TRANS, env.DISCORD_GUILD_ID),
  { body: bots.translation.commands }
)

await dajareClient.rest.put(
  Routes.applicationGuildCommands(
    env.DISCORD_APP_ID_DAJARE, env.DISCORD_GUILD_ID),
  { body: bots.dajare.commands }
)