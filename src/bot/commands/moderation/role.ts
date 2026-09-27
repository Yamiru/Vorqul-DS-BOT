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
  GuildMember,
  Role,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a role to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user') as GuildMember | null;
    const role = interaction.options.getRole('role', true) as Role;

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not in the server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const me = interaction.guild!.members.me!;
    if (role.position >= me.roles.highest.position) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This role is higher than or equal to my highest role.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const executor = interaction.member as GuildMember;
    if (role.position >= executor.roles.highest.position && interaction.guild!.ownerId !== executor.id) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'You cannot manage a role that is higher than yours.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'add') {
      if (target.roles.cache.has(role.id)) {
        await interaction.reply({
          embeds: [EmbedHelper.warning('Info', `${target.user.tag} already has the role ${role}.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await target.roles.add(role, `Added by ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [EmbedHelper.success('Role added', `${role} added to **${target.user.tag}**.`)]
      });
    } else {
      if (!target.roles.cache.has(role.id)) {
        await interaction.reply({
          embeds: [EmbedHelper.warning('Info', `${target.user.tag} does not have the role ${role}.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await target.roles.remove(role, `Removed by ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [EmbedHelper.success('Role removed', `${role} removed from **${target.user.tag}**.`)]
      });
    }
  }
};

export default command;
