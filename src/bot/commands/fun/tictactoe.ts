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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { reportError } from '../../../utils/errorReporter.js';

const EMPTY = '⬜';
const X = '❌';
const O = '⭕';

interface Game {
  board: string[];
  players: [string, string];
  currentPlayer: number;
  gameOver: boolean;
}

const activeGames = new Map<string, Game>();

function checkWin(board: string[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isDraw(board: string[]): boolean {
  return board.every(cell => cell !== EMPTY);
}

function createButtons(board: string[], disabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const cell = board[index];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${index}`)
          .setLabel(cell === EMPTY ? '‎' : ' ')
          .setEmoji(cell)
          .setStyle(cell === EMPTY ? ButtonStyle.Secondary :
                   cell === X ? ButtonStyle.Danger : ButtonStyle.Success)
          .setDisabled(disabled || cell !== EMPTY)
      );
    }
    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ttt_quit')
          .setLabel('Surrender')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled)
      )
  );

  return rows;
}

export default {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play Tic-Tac-Toe!')
    .addUserOption(opt =>
      opt.setName('hrac')
        .setDescription('Opponent')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('hrac', true);
    const db = getDatabase();

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot play against yourself!',
        flags: MessageFlags.Ephemeral
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: '❌ You cannot play against the bot!',
        flags: MessageFlags.Ephemeral
      });
    }

    const gameKey = `ttt-${interaction.guildId}-${interaction.user.id}`;
    if (activeGames.has(gameKey)) {
      return interaction.reply({
        content: '❌ You already have a game in progress!',
        flags: MessageFlags.Ephemeral
      });
    }

    const inviteEmbed = new EmbedBuilder()
      .setTitle('🎮 Tic-Tac-Toe - Invitation')
      .setDescription(`${opponent}, ${interaction.user} challenges you to Tic-Tac-Toe!\n\nYou have 60 seconds to accept.`)
      .setColor(0xFFD700);

    const inviteButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ttt_accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ttt_decline')
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      embeds: [inviteEmbed],
      components: [inviteButtons]
    });

    const msg = await interaction.fetchReply();

    try {
      const response = await msg.awaitMessageComponent({
        filter: i => i.user.id === opponent.id,
        componentType: ComponentType.Button,
        time: 60000
      });

      if (response.customId === 'ttt_decline') {
        await response.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Game declined')
              .setColor(0xFF0000)
          ],
          components: []
        });
        return;
      }

      const game: Game = {
        board: Array(9).fill(EMPTY),
        players: [interaction.user.id, opponent.id],
        currentPlayer: 0,
        gameOver: false
      };

      activeGames.set(gameKey, game);
      activeGames.set(`ttt-${interaction.guildId}-${opponent.id}`, game);

      const gameEmbed = new EmbedBuilder()
        .setTitle('🎮 Tic-Tac-Toe')
        .addFields(
          { name: `${X} X`, value: `<@${interaction.user.id}>`, inline: true },
          { name: `${O} Koliesko`, value: `<@${opponent.id}>`, inline: true }
        )
        .setFooter({ text: `Turn: ${interaction.user.username}` })
        .setColor(0xFF0000);

      await response.update({
        embeds: [gameEmbed],
        components: createButtons(game.board)
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000
      });

      collector.on('collect', async (i) => {
        const currentGame = activeGames.get(gameKey);
        if (!currentGame || currentGame.gameOver) {
          collector.stop();
          return;
        }

        if (i.user.id !== currentGame.players[currentGame.currentPlayer]) {
          await i.reply({ content: '❌ It is not your turn!', flags: MessageFlags.Ephemeral });
          return;
        }

        if (i.customId === 'ttt_quit') {
          currentGame.gameOver = true;
          const winnerId = currentGame.players[1 - currentGame.currentPlayer];

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Tic-Tac-Toe - End')
                .addFields({ name: '🏆 Winner', value: `<@${winnerId}> (opponent surrendered)` })
                .setColor(0x00FF00)
            ],
            components: createButtons(currentGame.board, true)
          });

          await updateStats(db, interaction.guildId!, winnerId, i.user.id);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        const index = parseInt(i.customId.split('_')[1]);
        const piece = currentGame.currentPlayer === 0 ? X : O;
        currentGame.board[index] = piece;

        const winner = checkWin(currentGame.board);
        if (winner) {
          currentGame.gameOver = true;

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Tic-Tac-Toe - End')
                .addFields({ name: '🏆 Winner', value: `<@${i.user.id}>` })
                .setColor(0x00FF00)
            ],
            components: createButtons(currentGame.board, true)
          });

          const loserId = currentGame.players[1 - currentGame.currentPlayer];
          await updateStats(db, interaction.guildId!, i.user.id, loserId);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        if (isDraw(currentGame.board)) {
          currentGame.gameOver = true;

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Tic-Tac-Toe - Draw')
                .setColor(0xFFFF00)
            ],
            components: createButtons(currentGame.board, true)
          });

          await updateStats(db, interaction.guildId!, null, null, true,
            currentGame.players[0], currentGame.players[1]);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        currentGame.currentPlayer = 1 - currentGame.currentPlayer;
        const nextUser = currentGame.currentPlayer === 0 ? interaction.user : opponent;

        const updatedEmbed = new EmbedBuilder()
          .setTitle('🎮 Tic-Tac-Toe')
          .addFields(
            { name: `${X} X`, value: `<@${interaction.user.id}>`, inline: true },
            { name: `${O} Koliesko`, value: `<@${opponent.id}>`, inline: true }
          )
          .setFooter({ text: `Turn: ${nextUser.username}` })
          .setColor(currentGame.currentPlayer === 0 ? 0xFF0000 : 0x00FF00);

        await i.update({
          embeds: [updatedEmbed],
          components: createButtons(currentGame.board)
        });
      });

      collector.on('end', async (_, reason) => {
        const currentGame = activeGames.get(gameKey);
        if (!currentGame || currentGame.gameOver) return;

        cleanup(gameKey, opponent.id, interaction.guildId!);

        if (reason === 'time') {
          try {
            await msg.edit({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⏰ Time is up')
                  .setColor(0xFF0000)
              ],
              components: createButtons(currentGame.board, true)
            });
          } catch (error) {
            reportError('tictactoe:timeout', error);
          }
        }
      });
    } catch {
      await msg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏰ Invitation expired')
            .setColor(0xFF0000)
        ],
        components: []
      });
    }
  }
};

async function updateStats(
  db: any,
  guildId: string,
  winnerId: string | null,
  loserId: string | null,
  tie: boolean = false,
  player1?: string,
  player2?: string
) {
  if (tie && player1 && player2) {
    for (const id of [player1, player2]) {
      const existing = await db.findOne('game_stats', {
        guild_id: guildId, user_id: id, game_type: 'tictactoe'
      });
      if (existing) {
        await db.update('game_stats', { ties: existing.ties + 1 }, { id: existing.id });
      } else {
        await db.insert('game_stats', {
          guild_id: guildId, user_id: id, game_type: 'tictactoe',
          wins: 0, losses: 0, ties: 1
        });
      }
    }
    return;
  }

  if (winnerId) {
    const existing = await db.findOne('game_stats', {
      guild_id: guildId, user_id: winnerId, game_type: 'tictactoe'
    });
    if (existing) {
      await db.update('game_stats', { wins: existing.wins + 1 }, { id: existing.id });
    } else {
      await db.insert('game_stats', {
        guild_id: guildId, user_id: winnerId, game_type: 'tictactoe',
        wins: 1, losses: 0, ties: 0
      });
    }
  }

  if (loserId) {
    const existing = await db.findOne('game_stats', {
      guild_id: guildId, user_id: loserId, game_type: 'tictactoe'
    });
    if (existing) {
      await db.update('game_stats', { losses: existing.losses + 1 }, { id: existing.id });
    } else {
      await db.insert('game_stats', {
        guild_id: guildId, user_id: loserId, game_type: 'tictactoe',
        wins: 0, losses: 1, ties: 0
      });
    }
  }
}

function cleanup(gameKey: string, opponentId: string, guildId: string) {
  activeGames.delete(gameKey);
  activeGames.delete(`ttt-${guildId}-${opponentId}`);
}
