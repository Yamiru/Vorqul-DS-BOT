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
    .setName('lock')
    .setDescription('Lock a channel (members will not be able to send messages)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel (defaults to current)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for locking')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const everyone = interaction.guild!.roles.everyone;

    if (!channel || !('permissionOverwrites' in channel)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This channel cannot be locked.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason });

    await interaction.reply({
      embeds: [EmbedHelper.warning(`🔒 Channel ${channel.name} has been locked`, `**Reason:** ${reason}`)]
    });
  }
};

export default command;
