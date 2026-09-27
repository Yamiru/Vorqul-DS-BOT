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
  Role,
  GuildMember
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { Jail } from '../../../utils/models.js';
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const JAIL_ROLE = 'Jailed';

async function ensureJailRole(interaction: ChatInputCommandInteraction): Promise<Role> {
  const guild = interaction.guild!;
  let role = guild.roles.cache.find(r => r.name === JAIL_ROLE);
  if (role) return role;

  role = await guild.roles.create({
    name: JAIL_ROLE,
    color: 0x546e7a,
    permissions: [],
    reason: 'Jail role'
  });

  for (const ch of guild.channels.cache.values()) {
    if ('permissionOverwrites' in ch) {
      try {
        await (ch as any).permissionOverwrites.edit(role, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Connect: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false
        });
      } catch (error) {
          logger.debug('jail: suppressed error', error);
        }
    }
  }
  return role;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail a member: remove their roles and isolate them until unjailed')
    .addUserOption(o => o.setName('user').setDescription('Member to jail').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null) as GuildMember | null;
    if (!member) {
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'That member is not on this server.')] });
      return;
    }
    if (!member.manageable) {
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'I cannot jail this member (their role is higher than mine).')] });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (
      interaction.guild!.ownerId !== moderator.id &&
      member.roles.highest.position >= moderator.roles.highest.position
    ) {
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'You cannot jail a member with an equal or higher role than you.')] });
      return;
    }

    const existing = await Jail.findOne({ guildId: interaction.guildId!, userId: target.id });
    if (existing) {
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'This member is already jailed.')] });
      return;
    }

    const jailRole = await ensureJailRole(interaction);

    const me = interaction.guild!.members.me!;
    const savedRoles = member.roles.cache
      .filter(r => r.id !== interaction.guild!.id && !r.managed && r.position < me.roles.highest.position)
      .map(r => r.id);

    await Jail.create({ guildId: interaction.guildId!, userId: target.id, roles: savedRoles, moderatorId: interaction.user.id, reason });

    try {
      await member.roles.set([jailRole.id], `Jailed: ${reason}`);
    } catch {
      await Jail.remove({ guildId: interaction.guildId!, userId: target.id });
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'Failed to apply the jail role.')] });
      return;
    }

    await interaction.editReply({
      embeds: [EmbedHelper.warning(`🔒 ${target.tag} has been jailed`, `**Reason:** ${reason}\nUse \`/unjail\` to restore their roles.`)]
    });
  }
};

export default command;
