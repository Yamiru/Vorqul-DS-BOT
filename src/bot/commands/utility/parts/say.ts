/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot send a message to a channel')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message text')
        .setMaxLength(2000)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel (defaults to current)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const message = interaction.options.getString('message', true);
    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;

    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'A message cannot be sent to this channel.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await channel.send({ content: message });
    await interaction.reply({
      embeds: [EmbedHelper.success('Sent', `Message sent to ${channel}.`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
