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
  Role
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('massnick')
    .setDescription('Set or reset the nickname for many members at once')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Set a nickname or reset to username')
        .setRequired(true)
        .addChoices(
          { name: 'Set', value: 'set' },
          { name: 'Reset', value: 'reset' }
        )
    )
    .addStringOption(option =>
      option.setName('nickname').setDescription('Nickname to apply (required for "Set")').setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('filter_role').setDescription('Only members who have this role').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  category: 'moderation',

  cooldown: 60,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageNicknames],
  botPermissions: [PermissionFlagsBits.ManageNicknames],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const isSet = interaction.options.getString('action', true) === 'set';
    const nickname = interaction.options.getString('nickname');
    const filterRole = interaction.options.getRole('filter_role') as Role | null;

    if (isSet && (!nickname || !nickname.trim())) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', 'Please provide a nickname when using the "Set" action.')]
      });
      return;
    }
    if (isSet && nickname!.length > 32) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', 'A nickname can be at most 32 characters.')]
      });
      return;
    }

    const members = await interaction.guild!.members.fetch();
    let changed = 0;
    let skipped = 0;

    for (const member of members.values()) {
      if (filterRole && !member.roles.cache.has(filterRole.id)) continue;
      if (!member.manageable) { skipped++; continue; }

      try {
        await member.setNickname(isSet ? nickname!.trim() : null, 'Mass nickname');
        changed++;
      } catch {
        skipped++;
      }
    }

    await interaction.editReply({
      embeds: [
        EmbedHelper.success(
          isSet ? '✅ Nicknames set' : '✅ Nicknames reset',
          `Updated **${changed}** member(s)${skipped ? `, ${skipped} skipped (higher role or owner)` : ''}.`
        )
      ]
    });
  }
};

export default command;
