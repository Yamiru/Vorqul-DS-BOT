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
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gamestats')
    .setDescription('Show game statistics')
    .addUserOption(opt =>
      opt.setName('hrac')
        .setDescription('Player (default: you)')
    )
    .addStringOption(opt =>
      opt.setName('hra')
        .setDescription('Specific game')
        .addChoices(
          { name: 'Connect 4', value: 'connect4' },
          { name: 'Tic-Tac-Toe', value: 'tictactoe' },
          { name: 'All', value: 'all' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('hrac') || interaction.user;
    const gameFilter = interaction.options.getString('hra') || 'all';
    const db = getDatabase();

    const where: any = {
      guild_id: interaction.guildId,
      user_id: user.id
    };

    if (gameFilter !== 'all') {
      where.game_type = gameFilter;
    }

    const stats = await db.find('game_stats', where);

    if (stats.length === 0) {
      return interaction.reply({
        content: `📊 ${user.id === interaction.user.id ? 'You have' : `${user.username} has`} no game statistics.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎮 Game statistics - ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x9B59B6);

    let totalWins = 0, totalLosses = 0, totalTies = 0;

    for (const stat of stats) {
      const gameName = stat.game_type === 'connect4' ? 'Connect 4' :
                       stat.game_type === 'tictactoe' ? 'Tic-Tac-Toe' : stat.game_type;

      const total = stat.wins + stat.losses + stat.ties;
      const winRate = total > 0 ? ((stat.wins / total) * 100).toFixed(1) : '0';

      embed.addFields({
        name: `🎲 ${gameName}`,
        value: [
          `✅ Wins: **${stat.wins}**`,
          `❌ Prehry: **${stat.losses}**`,
          `🤝 Draws: **${stat.ties}**`,
          `📈 Win Rate: **${winRate}%**`
        ].join('\n'),
        inline: true
      });

      totalWins += stat.wins;
      totalLosses += stat.losses;
      totalTies += stat.ties;
    }

    if (stats.length > 1 || gameFilter === 'all') {
      const totalGames = totalWins + totalLosses + totalTies;
      const overallWinRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0';

      embed.addFields({
        name: '📊 Celkovo',
        value: [
          `🎮 Hier: **${totalGames}**`,
          `✅ Wins: **${totalWins}**`,
          `❌ Prehry: **${totalLosses}**`,
          `🤝 Draws: **${totalTies}**`,
          `📈 Win Rate: **${overallWinRate}%**`
        ].join('\n'),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
