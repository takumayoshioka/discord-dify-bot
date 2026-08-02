import {
  SlashCommandBuilder,
  ChannelType,
  type Interaction,
} from "discord.js";

import {
  channelDB,
  ChannelConnectionFailure,
  ChannelDisconnectionFailure
} from "#src/db/dbManager";

export const CONNECT_COMMAND_NAME = "connect";
export const DISCONNECT_COMMAND_NAME = "disconnect";
export const CONNECT_DISCONNECT_OPTION = { ja: "ja", en: "en" };

// connect/disconnect command builder
export const connectCommand = new SlashCommandBuilder()
  .setName(CONNECT_COMMAND_NAME)
  .setDescription("Connect ja/en channels")
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
  );

export const disconnectCommand = new SlashCommandBuilder()
  .setName(DISCONNECT_COMMAND_NAME)
  .setDescription("Disconnect ja/en channels")
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
  );

// slash command interaction
// TODO: refine messages for users
export const botConnectionCommandsInteraction = async (
  interaction: Interaction
) => {
  if (!interaction.isChatInputCommand()) { return; }

  switch (interaction.commandName) {
    case CONNECT_COMMAND_NAME: {
      const jaChannel = interaction.options.getChannel(
        CONNECT_DISCONNECT_OPTION.ja
      );
      const enChannel = interaction.options.getChannel(
        CONNECT_DISCONNECT_OPTION.en
      );
      if (!jaChannel || !enChannel) {
        console.error("Invalid channel(s)");
        return;
      }
      await interaction.deferReply();
      try {
        await channelDB.enqueue(jaChannel.id, enChannel.id);
        interaction.editReply("Connected.")
      } catch (err) {
        if (err instanceof ChannelConnectionFailure) {
          interaction.editReply("Connection failured.")
        } else {
          throw err
        }
      }
      break;
    }

    case DISCONNECT_COMMAND_NAME: {
      const jaChannel = interaction.options.getChannel(
        CONNECT_DISCONNECT_OPTION.ja
      );
      const enChannel = interaction.options.getChannel(
        CONNECT_DISCONNECT_OPTION.en
      );
      if (!jaChannel || !enChannel) {
        console.error("Invalid channel(s)");
        return;
      }
      await interaction.deferReply();
      try {
        await channelDB.dequeue(jaChannel.id, enChannel.id);
        interaction.editReply("Disconnected.")
      } catch (err) {
        if (err instanceof ChannelDisconnectionFailure) {
          interaction.editReply("Disconnection failured.")
        } else {
          throw err
        }
      }
      break;
    }

    default: {
      console.error("Invalid command");
      return;
    }
  }
}