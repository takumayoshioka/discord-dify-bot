import {
  Client,
  Message,
  PermissionFlagsBits,
  TextChannel,
  Webhook,
  type Channel,
  type OmitPartialGroupDMChannel,
  type Snowflake,
} from 'discord.js';

import {
  createTranslationRequest,
  getTranslationResponseMessage,
  parseTranslationResponse
} from './jsonFormat.js';
import {
  getWorkflowURL,
  createTranslationRequestHeader
} from './translationURL.js';
import {
  getChannelPairs,
  initializeChannelTable
} from './channelTable.js';

type TranslationDirection = "ja-to-en" | "en-to-ja";
type TranslationTarget = {
  channelId: Snowflake;
  direction: TranslationDirection;
}

// not a target channel of the translation
class NotTargetChannel extends Error {
  constructor(message?: string) {
    super(message);
  }
}

// returns the translation target channel if it exists
const getTargetChannel = (channelId: Snowflake): TranslationTarget => {
  for (const { ja: idA, en: idB } of getChannelPairs()) {
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

// translation body
const translate = async (message: string, _dir: TranslationDirection) => {
  const response = await fetch(getWorkflowURL(), {
    method: "POST",
    headers: createTranslationRequestHeader(),
    body: JSON.stringify(createTranslationRequest(message)),
  });

  if (!response.ok) {
    throw new Error(`Server request failed: ${response.status}`);
  }

  const rawBody = await response.text();
  try {
    const body = parseTranslationResponse(rawBody);
    return getTranslationResponseMessage(body);
  } catch (err) {
    throw new Error(`Invalid response: \n${err}`);
  }
}

// webhooks cache
const mapWebhooks = new Map<Snowflake, Webhook>();
const botWebhookName: string = "Webhook: Translator Bot";

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
    v.name === botWebhookName
  ) ??
    await channel.createWebhook({ name: botWebhookName });

  mapWebhooks.set(channel.id, webhook);
  return webhook;
}

// login 
export const botLogin = async (client: Client<true>) => {
  // check bot permission
  const isPermission = client.guilds.cache.reduce(
    // this bot must have ManageWebhook permission
    (acc, guild) => {
      const botMember = guild.members.me;
      if (!botMember) { return false; }

      return acc
        && botMember.permissions.has(PermissionFlagsBits.ManageWebhooks);
    },
    true
  );

  if (isPermission) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    await initializeChannelTable();
  } else {
    console.error(
      `User ${client.user.tag} does not have ManageWebhook permission`
    );
    await client.destroy()
  }
}

// translate messages sent only in TextChannel
export const botTranslateSentMessage = (client: Client<boolean>) => async (
  message: OmitPartialGroupDMChannel<Message<boolean>>
) => {
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
    console.error("Failed to translate or forward message: \n", err);
  }
}
