import {
  Client,
  Events,
  GatewayIntentBits,
} from 'discord.js';

import { env } from "./env.js";
import { botLogin, botTransalte } from './translationBot.js';

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

client.login(env.DISCORD_TOKEN);