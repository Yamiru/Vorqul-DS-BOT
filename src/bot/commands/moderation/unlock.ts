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
    .setName('unlock')
    .setDescription('Unlock a channel (members will be able to send messages again)')
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
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
    const everyone = interaction.guild!.roles.everyone;

    if (!channel || !('permissionOverwrites' in channel)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This channel cannot be unlocked.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, {
      reason: `Unlocked by ${interaction.user.tag}`
    });

    await interaction.reply({
      embeds: [EmbedHelper.success(`🔓 Channel ${channel.name} has been unlocked`)]
    });
  }
};

export default command;
