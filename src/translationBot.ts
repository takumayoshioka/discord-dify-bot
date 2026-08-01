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
} from "discord.js";
import {
  find as linkifyFind
} from "linkifyjs";

import {
  createTranslationRequest,
  getTranslationResponseMessage,
  parseAttachmentFiles,
  parseTranslationResponse
} from "./jsonFormat.js";
import {
  getWorkflowURL,
  createTranslationRequestHeader
} from "./translationURL.js";
import {
  channelDB,
  messageDB,
  type TranslationDirection,
  NotTargetChannel
} from "./db/dbManager.js"

const isTextChannel = (channel: Channel): channel is TextChannel => {
  return channel instanceof TextChannel;
}

const hasURL = (message: string) => {
  return linkifyFind(message, "url").length > 0;
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
    v.owner?.id === channel.client.user.id &&
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
const sendTranslatedContentBody = async (targetChannel: TextChannel) => {
  const row = await messageDB.getTranslatedContent(targetChannel.id);

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
    files: parseAttachmentFiles(row.attachment_json),
    username: row.display_name,
    avatarURL: row.avatar_url,
  })

  await messageDB.dequeue(row.id);
  await sendTranslatedContentBody(targetChannel);
}

const sendTranslatedContent = async (targetChannel: TextChannel) => {
  if (waitingChannelIDs.has(targetChannel.id)) {
    return;
  } else {
    waitingChannelIDs.add(targetChannel.id);
    await sendTranslatedContentBody(targetChannel);
  }
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
    // await initializeChannelTable();
    await channelDB.init();
    await messageDB.init();
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
    const target = await channelDB.getTargetChannel(message.channelId);
    const targetChannel = await client.channels.fetch(target.channelID);

    // reject non-TextChannel
    if (!isTextChannel(targetChannel!)) { return; }

    const attachedFiles = [...message.attachments.values()]
      .map((attachment) => ({
        attachment: attachment.url,
        name: attachment.name
      }));

    // sending with copying author
    const content = message.content;
    const displayName =
      message.member?.displayName ??
      message.author.displayName;
    const avatarURL =
      message.member?.displayAvatarURL() ??
      message.author.displayAvatarURL();

    const rowID = await messageDB.enqueue(
      target.channelID,
      content,
      JSON.stringify(attachedFiles),
      displayName,
      avatarURL
    );

    if (!rowID) { return; }

    // get translation result
    const translatedRes = hasURL(content)
      ? content
      : await translate(content, target.direction);

    await messageDB.setTranslatedContent(rowID, translatedRes);
    await sendTranslatedContent(targetChannel);
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
