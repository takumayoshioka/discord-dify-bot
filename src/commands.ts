import {
  SlashCommandBuilder,
  ChannelType
} from "discord.js";

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
