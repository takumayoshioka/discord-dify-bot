import {
  SlashCommandBuilder,
  ChannelType,
  type Interaction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import {
  channelDB,
  messageDB,
  ChannelConnectionFailure,
  ChannelDisconnectionFailure,
  NotTargetChannel,
} from "#src/db/manager"

const CONNECT_COMMAND_NAME = "connect"
const DISCONNECT_COMMAND_NAME = "disconnect"
const SHOW_TARGET_COMMAND_NAME = "show-target"
const SHOW_ALL_COMMAND_NAME = "show-all"
const RESET_CHANNEL_DB_COMMAND_NAME = "reset-ch"
const RESET_MESSAGE_DB_COMMAND_NAME = "reset-msg"
const CONNECT_DISCONNECT_OPTION = { ja: "ja", en: "en" }
const SHOW_TARGET_OPTION = "ch"

// connect/disconnect command builder
export const connectCommand = new SlashCommandBuilder()
  .setName(CONNECT_COMMAND_NAME)
  .setDescription("Connect ja/en channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(CONNECT_DISCONNECT_OPTION.ja)
      .setDescription("Japanese channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName(CONNECT_DISCONNECT_OPTION.en)
      .setDescription("English channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

export const disconnectCommand = new SlashCommandBuilder()
  .setName(DISCONNECT_COMMAND_NAME)
  .setDescription("Disconnect ja/en channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(CONNECT_DISCONNECT_OPTION.ja)
      .setDescription("Japanese channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName(CONNECT_DISCONNECT_OPTION.en)
      .setDescription("English channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

export const showTargetCommand = new SlashCommandBuilder()
  .setName(SHOW_TARGET_COMMAND_NAME)
  .setDescription("Show connected target channel")
  .addChannelOption((option) =>
    option
      .setName(SHOW_TARGET_OPTION)
      .setDescription("Target channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

export const showAllCommand = new SlashCommandBuilder()
  .setName(SHOW_ALL_COMMAND_NAME)
  .setDescription("Show all connected channels")

export const resetChDBCommand = new SlashCommandBuilder()
  .setName(RESET_CHANNEL_DB_COMMAND_NAME)
  .setDescription("Reset channel DB")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

export const resetMsgDBCommand = new SlashCommandBuilder()
  .setName(RESET_MESSAGE_DB_COMMAND_NAME)
  .setDescription("Reset message DB")

const interactionConnect = async (
  interaction: ChatInputCommandInteraction
) => {
  const jaChannel = interaction.options.getChannel(
    CONNECT_DISCONNECT_OPTION.ja
  )
  const enChannel = interaction.options.getChannel(
    CONNECT_DISCONNECT_OPTION.en
  )
  if (!jaChannel || !enChannel) {
    console.error("Invalid channel(s)")
    return
  }
  await interaction.deferReply()
  try {
    await channelDB.enqueue(jaChannel.id, enChannel.id)
    await interaction.editReply("Connected.")
  } catch (err) {
    if (err instanceof ChannelConnectionFailure) {
      await interaction.editReply("Connection failure.")
    } else {
      await interaction.editReply("[Bot internal error: connect command]")
    }
  }
}

const interactionDisconnect = async (
  interaction: ChatInputCommandInteraction
) => {
  const jaChannel = interaction.options.getChannel(
    CONNECT_DISCONNECT_OPTION.ja
  )
  const enChannel = interaction.options.getChannel(
    CONNECT_DISCONNECT_OPTION.en
  )
  if (!jaChannel || !enChannel) {
    console.error("Invalid channel(s)")
    return
  }
  await interaction.deferReply()
  try {
    await channelDB.dequeue(jaChannel.id, enChannel.id)
    await interaction.editReply("Disconnected.")
  } catch (err) {
    if (err instanceof ChannelDisconnectionFailure) {
      await interaction.editReply("Disconnection failure.")
    } else {
      await interaction.editReply("[Bot internal error: disconnect command]")
    }
  }
}

const interactionShowTarget = async (
  interaction: ChatInputCommandInteraction
) => {
  const srcChannel = interaction.options.getChannel(SHOW_TARGET_OPTION)
  if (!srcChannel) {
    console.error("Invalid channel")
    return
  }
  await interaction.deferReply()
  try {
    const dstChannel = await channelDB.getTargetChannel(srcChannel.id)
    await interaction.editReply(`Target channel is <#${dstChannel.channelID}>`)
  } catch (err) {
    if (err instanceof NotTargetChannel) {
      await interaction.editReply(
        `Channel <#${srcChannel.id}> is not connected.`
      )
    } else {
      await interaction.editReply("[Bot internal error: show-target command]")
    }
  }
}

const interactionShowAll = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  const channelPairs = await channelDB.getAll()
  const channelPairTexts: string[] = []
  for (const { ja_channel_id, en_channel_id } of channelPairs) {
    channelPairTexts.push(
      `ja: <#${ja_channel_id}> :left_right_arrow: en: <#${en_channel_id}>`
    )
  }
  const replyText = (channelPairTexts.length === 0)
    ? "No connected channels"
    : channelPairTexts.join("\n")
  await interaction.editReply(replyText)
}

const interactionResetChDB = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  await channelDB.reset()
  await interaction.editReply("Channel DB cleared")
}

const interactionResetMsgDB = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  await messageDB.reset()
  await interaction.editReply("Message DB cleared")
}

// slash command interaction
// TODO: refine messages for users
export const botConnectionCommandsInteraction = async (
  interaction: Interaction
) => {
  if (!interaction.isChatInputCommand()) { return }

  switch (interaction.commandName) {
    case CONNECT_COMMAND_NAME: {
      await interactionConnect(interaction)
      break
    }

    case DISCONNECT_COMMAND_NAME: {
      await interactionDisconnect(interaction)
      break
    }

    case SHOW_TARGET_COMMAND_NAME: {
      await interactionShowTarget(interaction)
      break
    }

    case SHOW_ALL_COMMAND_NAME: {
      await interactionShowAll(interaction)
      break
    }

    case RESET_CHANNEL_DB_COMMAND_NAME: {
      await interactionResetChDB(interaction)
      break
    }

    case RESET_MESSAGE_DB_COMMAND_NAME: {
      await interactionResetMsgDB(interaction)
      break
    }

    default: {
      console.error("Invalid command")
      return
    }
  }
}