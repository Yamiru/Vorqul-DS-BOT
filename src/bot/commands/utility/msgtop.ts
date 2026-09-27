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

export default {
  data: new SlashCommandBuilder()
    .setName('msgtop')
    .setDescription('Leaderboard of the most active writers')
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

    const all = (await db.find('analytics_users', { guild_id: interaction.guildId })) as any[];
    const stats = all
      .map(r => ({ user_id: r.user_id, message_count: Number(r.messages) || 0 }))
      .sort((a, b) => b.message_count - a.message_count)
      .slice(0, limit);

    if (stats.length === 0) {
      return interaction.editReply({
        content: '📭 No message statistics yet.'
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('💬 Top pisatelia')
      .setColor(0x3498DB)
      .setTimestamp();

    const lines: string[] = [];
    let position = 1;

    for (const stat of stats) {
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;
      lines.push(`${medal} <@${stat.user_id}> - **${stat.message_count.toLocaleString()}** messages`);
      position++;
    }

    embed.setDescription(lines.join('\n'));

    const userStat = all.find(r => r.user_id === interaction.user.id);

    if (userStat) {
      const myCount = Number(userStat.messages) || 0;
      const rank = all.filter(r => (Number(r.messages) || 0) > myCount).length + 1;

      embed.setFooter({
        text: `Your position: #${rank} (${myCount.toLocaleString()} messages)`
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
