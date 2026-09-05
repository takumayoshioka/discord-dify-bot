import {
  SlashCommandBuilder,
  ChannelType,
  type Interaction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js"

import {
  ErrorSetFailure,
  ErrorRemoveFailure,
  errorDB,
  NoErrorReportChannel,
} from "#src/db/manager"

const SET_COMMAND_NAME = "set-error-ch"
const REMOVE_COMMAND_NAME = "remove-error-ch"
const SHOW_SET_COMMAND_NAME = "show-error-ch"
const RESET_ERROR_DB_COMMAND_NAME = "reset-error-ch"
const SET_REMOVE_OPTION = { ch: "ch" }

// connect/disconnect command builder
const setCommand = new SlashCommandBuilder()
  .setName(SET_COMMAND_NAME)
  .setDescription("Set error report channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(SET_REMOVE_OPTION.ch)
      .setDescription("Error report channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

const removeCommand = new SlashCommandBuilder()
  .setName(REMOVE_COMMAND_NAME)
  .setDescription("Remove error report channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName(SET_REMOVE_OPTION.ch)
      .setDescription("Error report channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )

const showSetCommand = new SlashCommandBuilder()
  .setName(SHOW_SET_COMMAND_NAME)
  .setDescription("Show error report channel")

const resetErrorDBCommand = new SlashCommandBuilder()
  .setName(RESET_ERROR_DB_COMMAND_NAME)
  .setDescription("Reset error report setting")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

export const commands = [
  setCommand,
  removeCommand,
  showSetCommand,
  resetErrorDBCommand
]

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
    await errorDB.enqueue(channel.id)
    await interaction.editReply("Set.")
  } catch (err) {
    if (err instanceof ErrorSetFailure) {
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
    await errorDB.dequeue(channel.id)
    await interaction.editReply("Removed.")
  } catch (err) {
    if (err instanceof ErrorRemoveFailure) {
      await interaction.editReply("Removal failure.")
    } else {
      await interaction.editReply("[Bot internal error: remove command]")
    }
  }
}

const interactionShowAll = async (
  interaction: ChatInputCommandInteraction
) => {
  try {
    await interaction.deferReply()
    const channelID = await errorDB.getFirst()
    await interaction.editReply(`<#${channelID}>`)
  } catch (err) {
    if (err instanceof NoErrorReportChannel) {
      await interaction.editReply("No error report channel")
    } else {
      await interaction.editReply("[Bot internal error: show command]")
    }
  }
}

const interactionResetChDB = async (
  interaction: ChatInputCommandInteraction
) => {
  await interaction.deferReply()
  await errorDB.reset()
  await interaction.editReply("Channel DB cleared")
}

// slash command interaction
// TODO: refine messages for users
export const botErrorCommandsInteraction = async (
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

    case RESET_ERROR_DB_COMMAND_NAME: {
      await interactionResetChDB(interaction)
      break
    }

    default: {
      return
    }
  }
}