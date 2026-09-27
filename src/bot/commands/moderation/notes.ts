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
  EmbedBuilder,
  ColorResolvable,
  MessageFlags
} from 'discord.js';
import { ModLog, Warning } from '../../../utils/models.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const ACTION_EMOJI: Record<string, string> = {
  note: '📝', warn: '⚠️', mute: '🔇', unmute: '🔊', timeout: '⏳', untimeout: '⏱️',
  kick: '👢', ban: '🔨', unban: '♻️', softban: '🧹'
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('Show moderator notes and moderation history for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to look up').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const user = interaction.options.getUser('user', true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const logs: any[] = await ModLog.find({ guildId, userId: user.id }).catch(() => []) || [];
    const warnings: any[] = await Warning.find({ guildId, odId: user.id }).catch(() => []) || [];

    const entries = logs
      .map((l: any) => ({
        action: l.action || 'log',
        reason: l.reason || '-',
        mod: l.moderator_id || l.moderatorId,
        at: l.created_at || l.createdAt
      }))
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 15);

    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation history - ${user.tag}`)
      .setColor(config.bot.embedColor as ColorResolvable)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .addFields({ name: 'Summary', value: `Warnings: **${warnings.length}** • Log entries: **${logs.length}**` });

    if (entries.length === 0) {
      embed.setDescription('No notes or moderation history for this user.');
    } else {
      embed.addFields({
        name: 'Recent entries',
        value: entries
          .map(e => {
            const emoji = ACTION_EMOJI[e.action] || '•';
            const when = e.at ? `<t:${Math.floor(new Date(e.at).getTime() / 1000)}:R>` : '';
            const mod = e.mod ? `<@${e.mod}>` : 'unknown';
            return `${emoji} **${e.action}** by ${mod} ${when}\n┗ ${String(e.reason).slice(0, 180)}`;
          })
          .join('\n')
          .slice(0, 4000)
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
