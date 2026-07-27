import {
  Client,
  Events,
  GatewayIntentBits,
  Routes,
} from 'discord.js';

import { env } from "./env.js";
import {
  botLogin,
  botTransalte,
  botChatInteraction,
} from './translationBot.js';
import {
  connectCommand,
  disconnectCommand
} from './commands.js';

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
client.on(Events.MessageCreate, botTransalte(client));
client.on(Events.InteractionCreate, botChatInteraction);

// login
await client.login(env.DISCORD_TOKEN);

// set slash command
await client.rest.put(
  Routes.applicationCommands(env.DISCORD_APP_ID),
  {
    body: [connectCommand.toJSON(), disconnectCommand.toJSON()]
  }
)