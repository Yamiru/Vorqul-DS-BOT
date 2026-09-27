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
  EmbedBuilder
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('vctop')
    .setDescription('Leaderboard of the most active voice users')
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Number to show (default: 10)')
        .setMinValue(5)
        .setMaxValue(25)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const limit = interaction.options.getInteger('limit') || 10;
    const db = getDatabase();

    await interaction.deferReply();

    const stats = await db.find('voice_stats', { guild_id: interaction.guildId }, {
      orderBy: 'total_time DESC',
      limit
    }) as any[];

    if (stats.length === 0) {
      return interaction.editReply({
        content: '📭 No voice statistics yet.'
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎤 Top Voice Time')
      .setColor(0x9B59B6)
      .setTimestamp();

    const lines: string[] = [];
    let position = 1;

    for (const stat of stats) {
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;
      lines.push(`${medal} <@${stat.user_id}> - **${formatTime(stat.total_time)}**`);
      position++;
    }

    embed.setDescription(lines.join('\n'));

    const userStat = await db.findOne('voice_stats', {
      guild_id: interaction.guildId,
      user_id: interaction.user.id
    });

    if (userStat) {
      const all = await db.find('voice_stats', { guild_id: interaction.guildId }) as any[];
      const rank = all.filter(r => (r.total_time || 0) > (userStat.total_time || 0)).length + 1;

      embed.setFooter({
        text: `Your position: #${rank} (${formatTime(userStat.total_time)})`
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
