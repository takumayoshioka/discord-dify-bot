import {
  Client,
  Events,
  GatewayIntentBits,
  TextChannel,
  Webhook,
  type Channel,
  type Snowflake
} from 'discord.js';

import { env } from "./env.js";
import "./jsonFormat.js";
import config from '../config.json' with { type: 'json' };
import { createTranslationRequest, parseTranslationResponse } from './jsonFormat.js';

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

const isTextChannel = (channel: Channel): channel is TextChannel => {
  return channel instanceof TextChannel;
}

const translate = async (message: string, _dir: TranslationDirection) => {
  // awaits the response of mock server
  const response = await fetch("http://127.0.0.1:8080/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify(createTranslationRequest(message)),
  });

  if (!response.ok) {
    throw new Error(`Mock server request failed: ${response.status}`);
  }

  const rawBody = await response.text();
  try {
    const body = parseTranslationResponse(rawBody);
    return body.data.outputs.message;
  } catch (err) {
    throw new Error(`Invalid response: \n${err}`);
  }
}

const client: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks
  ]
});

const mapWebhooks = new Map<Snowflake, Webhook>();

const BOT_WEBHOOK_NAME: string = "Webhook: Translator Bot";

const getWebhook = async (channel: TextChannel) => {
  const webhook = mapWebhooks.get(channel.id) ??
    await generateWebhook(channel);

  return webhook;
}

const generateWebhook = async (channel: TextChannel) => {
  const webhooks = await channel.fetchWebhooks();

  const webhook = webhooks?.find((v) =>
    v.isUserCreated() &&
    v.owner.id === channel.client.user.id &&
    v.name === BOT_WEBHOOK_NAME
  ) ??
    await channel.createWebhook({ name: BOT_WEBHOOK_NAME });

  mapWebhooks.set(channel.id, webhook);
  return webhook;
}

// login message
client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// translation event handling
// only for TextChannel
client.on(Events.MessageCreate, async (message) => {
  // ignore messages from bot or post through webhook 
  if (message.author.bot || message.webhookId) { return; }

  try {
    // get the target channel to which this bot sends a translation result
    const target = getTargetChannel(message.channelId);
    const targetChannel = await client.channels.fetch(target.channelId);

    // reject non-TextChannel
    if (!isTextChannel(targetChannel!)) { return; }

    // get translation result
    const translatedRes = await translate(message.content, target.direction);

    // sending with copying author
    const nickname =
      message.member?.displayName ??
      message.author.displayName;
    const avatar =
      message.member?.displayAvatarURL() ??
      message.author.displayAvatarURL();
    const webhook = await getWebhook(targetChannel);

    await webhook.send({
      content: translatedRes,
      username: nickname,
      avatarURL: avatar,
    })
  } catch (err) {
    if (err instanceof NotTargetChannel) { return; }
    console.error("Failed to translate or forward message: ", err);
  }
})

client.login(env.DISCORD_TOKEN);