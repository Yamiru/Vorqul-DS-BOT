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
  ChannelType,
  TextChannel
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock every text channel on the server at once')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Lock all channels or lift the lockdown')
        .setRequired(true)
        .addChoices(
          { name: 'Lock all', value: 'lock' },
          { name: 'Unlock all', value: 'unlock' }
        )
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the lockdown').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const lock = interaction.options.getString('action', true) === 'lock';
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const everyone = interaction.guild!.roles.everyone;

    const channels = interaction.guild!.channels.cache.filter(
      c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
    );

    let done = 0;
    let failed = 0;
    for (const ch of channels.values()) {
      try {
        await (ch as TextChannel).permissionOverwrites.edit(
          everyone,
          { SendMessages: lock ? false : null },
          { reason }
        );
        done++;
      } catch {
        failed++;
      }
    }

    await interaction.editReply({
      embeds: [
        EmbedHelper.warning(
          lock ? '🔒 Server lockdown enabled' : '🔓 Server lockdown lifted',
          `Updated **${done}** channel(s)${failed ? `, ${failed} failed (missing permissions)` : ''}.\n**Reason:** ${reason}`
        )
      ]
    });
  }
};

export default command;
