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
  GuildMember
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('altcheck')
    .setDescription('Heuristic alt-account check for a member (account age, avatar, roles)')
    .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',

  cooldown: 30,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('user', true);
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null) as GuildMember | null;

    const now = Date.now();
    const accountAgeDays = Math.floor((now - target.createdTimestamp) / 86400000);
    const joinedAgeDays = member?.joinedTimestamp ? Math.floor((now - member.joinedTimestamp) / 86400000) : null;
    const hasCustomAvatar = !!target.avatar;
    const roleCount = member ? Math.max(0, member.roles.cache.size - 1) : 0;

    let score = 0;
    const flags: string[] = [];
    if (accountAgeDays < 7) { score += 40; flags.push('Account younger than 7 days'); }
    else if (accountAgeDays < 30) { score += 25; flags.push('Account younger than 30 days'); }
    else if (accountAgeDays < 90) { score += 10; flags.push('Account younger than 90 days'); }
    if (!hasCustomAvatar) { score += 20; flags.push('Default avatar'); }
    if (joinedAgeDays !== null && joinedAgeDays < 1) { score += 15; flags.push('Joined less than a day ago'); }
    if (roleCount === 0) { score += 10; flags.push('No roles'); }
    if (target.bot) { score = 0; flags.length = 0; flags.push('This is a bot account'); }

    score = Math.min(100, score);
    const level = score >= 60 ? '🔴 High' : score >= 30 ? '🟠 Medium' : '🟢 Low';

    const desc =
      `**User:** ${target.tag} (${target.id})\n` +
      `**Account age:** ${accountAgeDays} day(s)\n` +
      (joinedAgeDays !== null ? `**On server:** ${joinedAgeDays} day(s)\n` : '') +
      `**Custom avatar:** ${hasCustomAvatar ? 'Yes' : 'No'}\n` +
      `**Roles:** ${roleCount}\n\n` +
      `**Alt risk:** ${level} (${score}/100)\n` +
      (flags.length ? `**Factors:**\n• ${flags.join('\n• ')}` : 'No notable factors.') +
      `\n\n_Heuristic only - Discord does not expose IP/VPN data to bots._`;

    await interaction.reply({ embeds: [EmbedHelper.info('🕵️ Alt-account check', desc)] });
  }
};

export default command;
