import {
  SlashCommandBuilder,
  ChannelType
} from "discord.js";

// connect/disconnect command builder
const connectCommand = new SlashCommandBuilder()
  .setName("connect")
  .setDescription("Connect ja/en channels")
  .addChannelOption((option) =>
    option
      .setName("ja")
      .setDescription("Japanese channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName("en")
      .setDescription("English channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  );

const disconnectCommand = new SlashCommandBuilder()
  .setName("disconnect")
  .setDescription("Disconnect ja/en channels")
  .addChannelOption((option) =>
    option
      .setName("ja")
      .setDescription("Japanese channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName("en")
      .setDescription("English channel")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  );
