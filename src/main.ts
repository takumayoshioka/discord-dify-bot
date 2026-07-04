import {
  Client,
  Events,
  GatewayIntentBits,
  type Snowflake
} from 'discord.js';

import { env } from "./env.js";
import config from '../config.json' with { type: 'json' };

// each dictionary relates two channels 
// whose all messages should be translated and 
// sent to the opposite channel
const channelTable: { ja: Snowflake, en: Snowflake }[] =
  config.channel_table;

// not a target channel of the translation
class NotTargetChannel extends Error {
  constructor(message?: string) {
    super(message);
  }
}

// returns the translation target channel if it exists
const getTargetChannel = (channelId: Snowflake) => {
  for (const { ja: idA, en: idB } of channelTable) {
    if (idA === channelId) {
      return idB;
    } else if (idB === channelId) {
      return idA;
    } else {
      continue;
    }
  }
  throw new NotTargetChannel(channelId);
};

const client: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// login message
client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) { return; }

  try {
    const targetChannelId = getTargetChannel(message.channelId);
    const targetChannel = await client.channels.fetch(targetChannelId);
    if (targetChannel?.isSendable()) {
      // sends a reversed message to the target channel
      await targetChannel?.send(message.content.split("").reverse().join(""));
    }
  } catch (err) {
    if (err instanceof NotTargetChannel) {
      return;
    } else {
      console.log("Unknown error: ", err);
    }
  }
})

client.login(env.DISCORD_TOKEN);