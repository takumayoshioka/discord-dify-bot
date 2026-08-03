import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Routes,
} from "discord.js";

import { env } from "#src/env";
import {
  botLogin,
  botTranslateSentMessage,
  translateMessageCommand,
  botTranslateReplybyCommand,
  botTranslateEmojiMessage,
} from "#src/translationBot";
import {
  connectCommand,
  disconnectCommand,
  botConnectionCommandsInteraction,
  showTargetCommand,
  showAllCommand,
} from "#src/connectionCommands";

const client: Client = new Client({
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
});

// login message
client.once(Events.ClientReady, botLogin);
client.on(Events.MessageCreate, botTranslateSentMessage(client));
client.on(Events.InteractionCreate, botTranslateReplybyCommand);
client.on(Events.MessageReactionAdd, botTranslateEmojiMessage);
client.on(Events.InteractionCreate, botConnectionCommandsInteraction);

// login
await client.login(env.DISCORD_TOKEN);

// set slash command
await client.rest.put(
  Routes.applicationGuildCommands(
    env.DISCORD_APP_ID, env.DISCORD_GUILD_ID),
  {
    body: [
      translateMessageCommand.toJSON(),
      connectCommand.toJSON(),
      disconnectCommand.toJSON(),
      showTargetCommand.toJSON(),
      showAllCommand.toJSON(),
    ]
  }
)