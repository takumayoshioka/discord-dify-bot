import {
  Client,
  Events,
  GatewayIntentBits,
  type Snowflake
} from 'discord.js';

import { env } from "./env.js";
import config from '../config.json' with { type: 'json' };

type TranslationDirection = "ja-to-en" | "en-to-ja";
type TranslationTarget = {
  channelId: Snowflake;
  direction: TranslationDirection;
}

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
const getTargetChannel = (channelId: Snowflake): TranslationTarget => {
  for (const { ja: idA, en: idB } of channelTable) {
    if (idA === channelId) {
      return { channelId: idB, direction: "ja-to-en" };
    } else if (idB === channelId) {
      return { channelId: idA, direction: "en-to-ja" };
    }
  }
  throw new NotTargetChannel(channelId);
};

const translate = async (message: string, _dir: TranslationDirection) => {
  // awaits the response of mock server
  const response = await fetch("http://127.0.0.1:8080/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify({ message, }),
  });

  if (!response.ok) {
    throw new Error(`Mock server request failed: ${response.status}`);
  }

  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("translatedText" in body) ||
    typeof body.translatedText !== "string"
  ) {
    throw new Error("Mock server returned an invalid response");
  }

  return body.translatedText;
}

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

// translation event handling
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) { return; }

  try {
    const target = getTargetChannel(message.channelId);
    const targetChannel = await client.channels.fetch(target.channelId);

    // if targetChannel is not sendable, just returns
    if (!targetChannel?.isSendable()) { return; }

    const translatedRes = await translate(message.content, target.direction);
    await targetChannel.send(translatedRes);
  } catch (err) {
    if (err instanceof NotTargetChannel) { return; }
    console.error("Failed to translate or forward message: ", err);
  }
})

client.login(env.DISCORD_TOKEN);