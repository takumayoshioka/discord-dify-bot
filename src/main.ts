import {
  Client,
  Events,
  GatewayIntentBits,
  Routes,
} from "discord.js";

import { env } from "#src/env";
import {
  botLogin,
  botTranslateSentMessage,
  translateMessageCommand,
  botTranslateReplybyCommand,
} from "#src/translationBot";
import {
  connectCommand,
  disconnectCommand,
  botConnectionCommandsInteraction,
} from "#src/connectionCommands";

const client: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks
  ]
});

// login message
client.once(Events.ClientReady, botLogin);
client.on(Events.MessageCreate, botTranslateSentMessage(client));
client.on(Events.InteractionCreate, botTranslateReplybyCommand);
client.on(Events.InteractionCreate, botConnectionCommandsInteraction);

// login
await client.login(env.DISCORD_TOKEN);

// set slash command
await client.rest.put(
  Routes.applicationCommands(env.DISCORD_APP_ID),
  {
    body: [
      translateMessageCommand.toJSON(),
      connectCommand.toJSON(),
      disconnectCommand.toJSON(),
    ]
  }
)