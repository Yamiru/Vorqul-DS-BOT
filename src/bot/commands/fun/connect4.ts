/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { reportError } from '../../../utils/errorReporter.js';

const EMPTY = '⚫';
const RED = '🔴';
const YELLOW = '🟡';
const COLS = 7;
const ROWS = 6;

interface Game {
  board: string[][];
  players: [string, string];
  currentPlayer: number;
  gameOver: boolean;
  winner: string | null;
}

const activeGames = new Map<string, Game>();

function createBoard(): string[][] {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
}

function renderBoard(board: string[][]): string {
  const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];
  let display = numbers.join('') + '\n';
  for (const row of board) {
    display += row.join('') + '\n';
  }
  return display;
}

function dropPiece(board: string[][], col: number, piece: string): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === EMPTY) {
      board[row][col] = piece;
      return row;
    }
  }
  return -1;
}

function checkWin(board: string[][], row: number, col: number, piece: string): boolean {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === piece) {
        count++;
      } else break;
    }

    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === piece) {
        count++;
      } else break;
    }

    if (count >= 4) return true;
  }
  return false;
}

function isBoardFull(board: string[][]): boolean {
  return board[0].every(cell => cell !== EMPTY);
}

function createButtons(disabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId('c4_0').setLabel('1').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_1').setLabel('2').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_2').setLabel('3').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_3').setLabel('4').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId('c4_4').setLabel('5').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_5').setLabel('6').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_6').setLabel('7').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('c4_quit').setLabel('Surrender').setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );

  return [row1, row2];
}

export default {
  data: new SlashCommandBuilder()
    .setName('connect4')
    .setDescription('Play Connect 4!')
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

    const gameKey = `${interaction.guildId}-${interaction.user.id}`;
    if (activeGames.has(gameKey)) {
      return interaction.reply({
        content: '❌ You already have a game in progress!',
        flags: MessageFlags.Ephemeral
      });
    }

    const inviteEmbed = new EmbedBuilder()
      .setTitle('🎮 Connect 4 - Invitation')
      .setDescription(`${opponent}, ${interaction.user} challenges you to Connect 4!\n\nYou have 60 seconds to accept.`)
      .setColor(0xFFD700);

    const inviteButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('c4_accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('c4_decline')
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      embeds: [inviteEmbed],
      components: [inviteButtons]
    });

    const inviteMsg = await interaction.fetchReply();

    try {
      const response = await inviteMsg.awaitMessageComponent({
        filter: i => i.user.id === opponent.id,
        componentType: ComponentType.Button,
        time: 60000
      });

      if (response.customId === 'c4_decline') {
        await response.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Game declined')
              .setDescription(`${opponent} odmietol hru.`)
              .setColor(0xFF0000)
          ],
          components: []
        });
        return;
      }

      const game: Game = {
        board: createBoard(),
        players: [interaction.user.id, opponent.id],
        currentPlayer: 0,
        gameOver: false,
        winner: null
      };

      activeGames.set(gameKey, game);
      activeGames.set(`${interaction.guildId}-${opponent.id}`, game);

      const gameEmbed = new EmbedBuilder()
        .setTitle('🎮 Connect 4')
        .setDescription(renderBoard(game.board))
        .addFields(
          { name: `${RED} Red`, value: `<@${interaction.user.id}>`, inline: true },
          { name: `${YELLOW} Yellow`, value: `<@${opponent.id}>`, inline: true }
        )
        .setFooter({ text: `Turn: ${interaction.user.username}` })
        .setColor(0xFF0000);

      await response.update({
        embeds: [gameEmbed],
        components: createButtons()
      });

      const collector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
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

        if (i.customId === 'c4_quit') {
          currentGame.gameOver = true;
          currentGame.winner = currentGame.players[1 - currentGame.currentPlayer];

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Connect 4 - Koniec')
                .setDescription(renderBoard(currentGame.board))
                .addFields({ name: '🏆 Winner', value: `<@${currentGame.winner}> (opponent surrendered)` })
                .setColor(0x00FF00)
            ],
            components: createButtons(true)
          });

          await updateStats(db, interaction.guildId!, currentGame.winner, i.user.id);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        const col = parseInt(i.customId.split('_')[1]);
        const piece = currentGame.currentPlayer === 0 ? RED : YELLOW;
        const row = dropPiece(currentGame.board, col, piece);

        if (row === -1) {
          await i.reply({ content: '❌ This column is full!', flags: MessageFlags.Ephemeral });
          return;
        }

        if (checkWin(currentGame.board, row, col, piece)) {
          currentGame.gameOver = true;
          currentGame.winner = i.user.id;

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Connect 4 - Koniec')
                .setDescription(renderBoard(currentGame.board))
                .addFields({ name: '🏆 Winner', value: `<@${i.user.id}>` })
                .setColor(0x00FF00)
            ],
            components: createButtons(true)
          });

          const loserId = currentGame.players[1 - currentGame.currentPlayer];
          await updateStats(db, interaction.guildId!, i.user.id, loserId);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        if (isBoardFull(currentGame.board)) {
          currentGame.gameOver = true;

          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎮 Connect 4 - Draw')
                .setDescription(renderBoard(currentGame.board))
                .setColor(0xFFFF00)
            ],
            components: createButtons(true)
          });

          await updateStats(db, interaction.guildId!, null, null, true);
          cleanup(gameKey, opponent.id, interaction.guildId!);
          collector.stop();
          return;
        }

        currentGame.currentPlayer = 1 - currentGame.currentPlayer;
        const nextUser = currentGame.currentPlayer === 0 ? interaction.user : opponent;

        const updatedEmbed = new EmbedBuilder()
          .setTitle('🎮 Connect 4')
          .setDescription(renderBoard(currentGame.board))
          .addFields(
            { name: `${RED} Red`, value: `<@${interaction.user.id}>`, inline: true },
            { name: `${YELLOW} Yellow`, value: `<@${opponent.id}>`, inline: true }
          )
          .setFooter({ text: `Turn: ${nextUser.username}` })
          .setColor(currentGame.currentPlayer === 0 ? 0xFF0000 : 0xFFFF00);

        await i.update({ embeds: [updatedEmbed] });
      });

      collector.on('end', async (_, reason) => {
        const currentGame = activeGames.get(gameKey);
        if (!currentGame || currentGame.gameOver) return;

        cleanup(gameKey, opponent.id, interaction.guildId!);

        if (reason === 'time') {
          try {
            await inviteMsg.edit({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⏰ Connect 4 - Time is up')
                  .setDescription('The game was ended due to inactivity.')
                  .setColor(0xFF0000)
              ],
              components: createButtons(true)
            });
          } catch (error) {
            reportError('connect4:timeout', error);
          }
        }
      });
    } catch {
      await inviteMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏰ Invitation expired')
            .setDescription('The opponent did not respond in time.')
            .setColor(0xFF0000)
        ],
        components: []
      });
    }
  }
};

async function updateStats(db: any, guildId: string, winnerId: string | null, loserId: string | null, tie: boolean = false) {
  if (tie) return;

  if (winnerId) {
    const existing = await db.findOne('game_stats', {
      guild_id: guildId,
      user_id: winnerId,
      game_type: 'connect4'
    });

    if (existing) {
      await db.update('game_stats', { wins: existing.wins + 1 }, { id: existing.id });
    } else {
      await db.insert('game_stats', {
        guild_id: guildId,
        user_id: winnerId,
        game_type: 'connect4',
        wins: 1,
        losses: 0,
        ties: 0
      });
    }
  }

  if (loserId) {
    const existing = await db.findOne('game_stats', {
      guild_id: guildId,
      user_id: loserId,
      game_type: 'connect4'
    });

    if (existing) {
      await db.update('game_stats', { losses: existing.losses + 1 }, { id: existing.id });
    } else {
      await db.insert('game_stats', {
        guild_id: guildId,
        user_id: loserId,
        game_type: 'connect4',
        wins: 0,
        losses: 1,
        ties: 0
      });
    }
  }
}

function cleanup(gameKey: string, opponentId: string, guildId: string) {
  activeGames.delete(gameKey);
  activeGames.delete(`${guildId}-${opponentId}`);
}
