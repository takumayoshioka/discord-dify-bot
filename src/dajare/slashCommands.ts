import {
  SlashCommandBuilder,
  ChannelType,
  type Interaction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import {
  DajareSetFailure,
  DajareRemoveFailure,
  dajareDB,
} from "#src/db/manager"

const SET_COMMAND_NAME = "set-dajare-ch"
const REMOVE_COMMAND_NAME = "remove-dajare-ch"
const SHOW_SET_COMMAND_NAME = "show-dajare-ch"
const RESET_DAJARE_DB_COMMAND_NAME = "reset-dajare-ch"
const SET_REMOVE_OPTION = { ch: "ch" }

// connect/disconnect command builder
export const setCommand = new SlashCommandBuilder()
  .setName(SET_COMMAND_NAME)
  .setDescription("Set dajare channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(SET_REMOVE_OPTION.ch)
      .setDescription("Dajare channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

export const removeCommand = new SlashCommandBuilder()
  .setName(REMOVE_COMMAND_NAME)
  .setDescription("Remove dajare channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(SET_REMOVE_OPTION.ch)
      .setDescription("Dajare channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

export const showSetCommand = new SlashCommandBuilder()
  .setName(SHOW_SET_COMMAND_NAME)
  .setDescription("Show dajare channel")

export const resetDajareDBCommand = new SlashCommandBuilder()
  .setName(RESET_DAJARE_DB_COMMAND_NAME)
  .setDescription("Reset dajare setting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

const interactionSet = async (
  interaction: ChatInputCommandInteraction
) => {
  const channel = interaction.options.getChannel(
    SET_REMOVE_OPTION.ch
  )
  if (channel === null) {
    console.error("Invalid channel")
    return
  }
  await interaction.deferReply()
  try {
    await dajareDB.enqueue(channel.id)
    await interaction.editReply("Set.")
  } catch (err) {
    if (err instanceof DajareSetFailure) {
      await interaction.editReply("Set failure.")
    } else {
      await interaction.editReply("[Bot internal error: set command]")
    }
  }
}

const interactionDisconnect = async (
  interaction: ChatInputCommandInteraction
) => {
  const channel = interaction.options.getChannel(
    SET_REMOVE_OPTION.ch
  )
  if (channel === null) {
    console.error("Invalid channel")
    return
  }
  await interaction.deferReply()
  try {
    await dajareDB.dequeue(channel.id)
    await interaction.editReply("Removed.")
  } catch (err) {
    if (err instanceof DajareRemoveFailure) {
      await interaction.editReply("Removal failure.")
    } else {
      await interaction.editReply("[Bot internal error: remove command]")
    }
  }
}

const interactionShowAll = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  const channelIDs = await dajareDB.getAll()
  const channelsText: string[] = []
  for (const { channel_id } of channelIDs) {
    channelsText.push(`<#${channel_id}>`)
  }
  const replyText = (channelsText.length === 0)
    ? "No dajare channel"
    : channelsText.join("\n")
  await interaction.editReply(replyText)
}

const interactionResetChDB = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  await dajareDB.reset()
  await interaction.editReply("Channel DB cleared")
}

// slash command interaction
// TODO: refine messages for users
export const botDajareCommandsInteraction = async (
  interaction: Interaction
) => {
  if (!interaction.isChatInputCommand()) { return }

  switch (interaction.commandName) {
    case SET_COMMAND_NAME: {
      await interactionSet(interaction)
      break
    }

    case REMOVE_COMMAND_NAME: {
      await interactionDisconnect(interaction)
      break
    }

    case SHOW_SET_COMMAND_NAME: {
      await interactionShowAll(interaction)
      break
    }

    case RESET_DAJARE_DB_COMMAND_NAME: {
      await interactionResetChDB(interaction)
      break
    }

    default: {
      console.error("Invalid command")
      return
    }
  }
}