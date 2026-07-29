import {
  SlashCommandBuilder,
  ChannelType,
  type Interaction,
} from "discord.js";
import {
  connectChannelPair,
  disconnectChannelPair,
} from './channelTable.js';

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
      const isConnected = await connectChannelPair(
        { ja: jaChannel.id, en: enChannel.id }
      );
      await (isConnected)
        ? interaction.editReply("Connected.")
        : interaction.editReply("Connection failured.")
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
      const isConnected = await disconnectChannelPair(
        { ja: jaChannel.id, en: enChannel.id }
      );
      await (isConnected)
        ? interaction.editReply("Disconnected.")
        : interaction.editReply("Disconnection failured.")
      break;
    }

    default: {
      console.error("Invalid command");
      return;
    }
  }
}