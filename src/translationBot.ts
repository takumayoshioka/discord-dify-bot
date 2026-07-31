import {
  ApplicationCommandType,
  Client,
  ContextMenuCommandBuilder,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  Webhook,
  type Channel,
  type Interaction,
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
import {
  type MsgDB,
  openMsgDB,
  initMsgDB,
  enqueueMsgDB,
  setTranslatedContentMsgDB,
  getTranslatedContentMsgDB,
  deleteTranslatedContentMsgDB
} from "./messageDB.js"

// Message Database
let msgDB: MsgDB;

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

// translation request
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

// collects channel IDs that has non-sent messages 
const waitingChannelIDs = new Set<string>();

// send translated messages from message database
// waitingChannelIDs must have targetChannel.id in this function
const sendTranslatedContent = async (targetChannel: TextChannel) => {
  const row = await getTranslatedContentMsgDB(msgDB, targetChannel.id);

  if (!row) {
    waitingChannelIDs.delete(targetChannel.id);
    return;
  }
  if (!(row.translated_content)) {
    waitingChannelIDs.delete(targetChannel.id);
    return;
  }

  const webhook = await getWebhook(targetChannel);
  await webhook.send({
    content: row.translated_content,
    username: row.display_name,
    avatarURL: row.avatar_url,
  })

  await deleteTranslatedContentMsgDB(msgDB, row.id);
  await sendTranslatedContent(targetChannel);
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
    msgDB = await openMsgDB();
    await initMsgDB(msgDB);
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

    // sending with copying author
    const displayName =
      message.member?.displayName ??
      message.author.displayName;
    const avatarURL =
      message.member?.displayAvatarURL() ??
      message.author.displayAvatarURL();

    const rowID = await enqueueMsgDB(
      msgDB,
      target.channelId,
      message.content,
      displayName,
      avatarURL
    );

    if (!rowID) { return; }

    // get translation result
    const translatedRes = await translate(message.content, target.direction);

    await setTranslatedContentMsgDB(msgDB, rowID, translatedRes);
    if (!waitingChannelIDs.has(targetChannel.id)) {
      waitingChannelIDs.add(targetChannel.id);
      await sendTranslatedContent(targetChannel);
    }
  } catch (err) {
    if (err instanceof NotTargetChannel) { return; }
    console.error("Failed to translate or forward message: \n", err);
  }
}

// ------------------------------------------------------------

// build a translate command in context menu
export const translateMessageCommand = new ContextMenuCommandBuilder()
  .setName("translate")
  .setType(ApplicationCommandType.Message);

// translate messages if it selected by context menu
export const botTranslateReplybyCommand = async (
  interaction: Interaction
) => {
  if (!interaction.isMessageContextMenuCommand()) { return; }

  // const commandName = interaction.commandName;
  // const dir: TranslationDirection | null =
  //   (commandName === "ja-to-en") ? "ja-to-en"
  //     : (commandName === "en-to-ja") ? "en-to-ja" : null;
  // if (!dir) { return; }

  // direction does not used 
  const dir: TranslationDirection = "ja-to-en";

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  const message = interaction.targetMessage;
  const translatedRes = await translate(message.content, dir);

  await interaction.editReply(translatedRes);
}
