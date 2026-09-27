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
    .setName('massrole')
    .setDescription('Add or remove a role from many members at once')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Add or remove the role')
        .setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        )
    )
    .addRoleOption(option =>
      option.setName('role').setDescription('The role to add or remove').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Who to apply it to (default: everyone)')
        .setRequired(false)
        .addChoices(
          { name: 'All members', value: 'all' },
          { name: 'Humans only', value: 'humans' },
          { name: 'Bots only', value: 'bots' }
        )
    )
    .addRoleOption(option =>
      option.setName('filter_role').setDescription('Only members who already have this role').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',

  cooldown: 60,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const add = interaction.options.getString('action', true) === 'add';
    const role = interaction.options.getRole('role', true) as Role;
    const target = interaction.options.getString('target') || 'all';
    const filterRole = interaction.options.getRole('filter_role') as Role | null;

    const me = interaction.guild!.members.me;
    if (!me || role.position >= me.roles.highest.position) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', `I cannot manage **${role.name}** - my role must be above it in Server Settings → Roles.`)]
      });
      return;
    }
    if (role.managed) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', `**${role.name}** is managed by an integration and cannot be assigned manually.`)]
      });
      return;
    }

    const members = await interaction.guild!.members.fetch();
    let changed = 0;
    let skipped = 0;

    for (const member of members.values()) {
      if (target === 'humans' && member.user.bot) continue;
      if (target === 'bots' && !member.user.bot) continue;
      if (filterRole && !member.roles.cache.has(filterRole.id)) continue;

      const has = member.roles.cache.has(role.id);
      if ((add && has) || (!add && !has)) continue;

      try {
        if (add) await member.roles.add(role.id, 'Mass role');
        else await member.roles.remove(role.id, 'Mass role');
        changed++;
      } catch {
        skipped++;
      }
    }

    await interaction.editReply({
      embeds: [
        EmbedHelper.success(
          add ? '✅ Role added' : '✅ Role removed',
          `${add ? 'Added' : 'Removed'} **${role.name}** ${add ? 'to' : 'from'} **${changed}** member(s)${skipped ? `, ${skipped} skipped` : ''}.`
        )
      ]
    });
  }
};

export default command;
