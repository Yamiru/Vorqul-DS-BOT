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
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode (rate limit) in a channel')
    .addIntegerOption(option =>
      option
        .setName('seconds')
        .setDescription('Seconds (0 = off, max 21600)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel (defaults to current)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const seconds = interaction.options.getInteger('seconds', true);
    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;

    if (!channel || !('setRateLimitPerUser' in channel)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Slowmode cannot be set in this channel.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode changed by ${interaction.user.tag}`);

    const msg = seconds === 0
      ? `Slowmode in ${channel} has been turned off.`
      : `Slowmode in ${channel} set to **${seconds}s**.`;

    await interaction.reply({
      embeds: [EmbedHelper.success('Slowmode updated', msg)]
    });
  }
};

export default command;
