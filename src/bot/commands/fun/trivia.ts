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
  ComponentType
} from 'discord.js';
import axios from 'axios';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { UserData } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const REWARD_COINS = 50;
const REWARD_XP = 25;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Answer trivia questions to earn rewards')
    .addStringOption(opt =>
      opt
        .setName('category')
        .setDescription('Question category')
        .setRequired(false)
        .addChoices(
          { name: '🎮 Video Games', value: '15' },
          { name: '🎬 Movies', value: '11' },
          { name: '📺 TV Shows', value: '14' },
          { name: '🎵 Music', value: '12' },
          { name: '📚 Books', value: '10' },
          { name: '🔬 Science', value: '17' },
          { name: '🌍 Geography', value: '22' },
          { name: '📜 History', value: '23' },
          { name: '🎨 Art', value: '25' },
          { name: '🏀 Sports', value: '21' },
          { name: '🎲 Random', value: 'random' }
        )
    )
    .addStringOption(opt =>
      opt
        .setName('difficulty')
        .setDescription('Question difficulty')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' }
        )
    ),

  category: 'fun',
  guildOnly: true,
  cooldown: 10,

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const category = interaction.options.getString('category') || 'random';
    const difficulty = interaction.options.getString('difficulty') || 'medium';
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    try {
      let apiUrl = `https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${difficulty}`;
      if (category !== 'random') {
        apiUrl += `&category=${category}`;
      }

      const response = await axios.get(apiUrl, { timeout: 10000 });

      if (response.data.response_code !== 0 || !response.data.results[0]) {
        await interaction.editReply({
          embeds: [EmbedHelper.error('Error', 'Failed to fetch trivia question. Try again!')]
        });
        return;
      }

      const question = response.data.results[0];
      const correctAnswer = decodeHtml(question.correct_answer);
      const allAnswers = [
        ...question.incorrect_answers.map((a: string) => decodeHtml(a)),
        correctAnswer
      ].sort(() => Math.random() - 0.5);

      const difficultyEmoji = {
        easy: '🟢',
        medium: '🟡',
        hard: '🔴'
      }[difficulty] || '🟡';

      const difficultyMultiplier = {
        easy: 1,
        medium: 1.5,
        hard: 2
      }[difficulty] || 1;

      const embed = new EmbedBuilder()
        .setTitle('🎯 Trivia Time!')
        .setDescription(
          `**Category:** ${decodeHtml(question.category)}\n` +
          `**Difficulty:** ${difficultyEmoji} ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}\n\n` +
          `**Question:**\n${decodeHtml(question.question)}`
        )
        .setColor('#5865F2')
        .setFooter({ text: `Reward: ${Math.round(REWARD_COINS * difficultyMultiplier)} coins + ${Math.round(REWARD_XP * difficultyMultiplier)} XP • 30 seconds to answer` })
        .setTimestamp();

      const buttons = allAnswers.map((answer, index) =>
        new ButtonBuilder()
          .setCustomId(`trivia_${index}`)
          .setLabel(answer.substring(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < buttons.length; i += 2) {
        rows.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 2))
        );
      }

      const reply = await interaction.editReply({
        embeds: [embed],
        components: rows
      });

      try {
        const collected = await reply.awaitMessageComponent({
          filter: (i) => i.user.id === odId,
          time: 30000,
          componentType: ComponentType.Button
        });

        const selectedIndex = parseInt(collected.customId.split('_')[1]);
        const selectedAnswer = allAnswers[selectedIndex];
        const isCorrect = selectedAnswer === correctAnswer;

        const updatedButtons = allAnswers.map((answer, index) => {
          const btn = new ButtonBuilder()
            .setCustomId(`trivia_done_${index}`)
            .setLabel(answer.substring(0, 80))
            .setDisabled(true);

          if (answer === correctAnswer) {
            btn.setStyle(ButtonStyle.Success);
          } else if (index === selectedIndex && !isCorrect) {
            btn.setStyle(ButtonStyle.Danger);
          } else {
            btn.setStyle(ButtonStyle.Secondary);
          }

          return btn;
        });

        const updatedRows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < updatedButtons.length; i += 2) {
          updatedRows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(updatedButtons.slice(i, i + 2))
          );
        }

        if (isCorrect) {
          const coins = Math.round(REWARD_COINS * difficultyMultiplier);
          const xp = Math.round(REWARD_XP * difficultyMultiplier);

          await UserData.findOneAndUpdate(
            { odId, guildId },
            { $inc: { balance: coins, xp: xp, totalXp: xp } },
            { upsert: true }
          );

          embed.setColor('#57F287');
          embed.addFields({
            name: '✅ Correct!',
            value: `You earned **${coins} coins** and **${xp} XP**!`,
            inline: false
          });
        } else {
          embed.setColor('#ED4245');
          embed.addFields({
            name: '❌ Wrong!',
            value: `The correct answer was: **${correctAnswer}**`,
            inline: false
          });
        }

        await collected.update({ embeds: [embed], components: updatedRows });
      } catch {
        const timeoutButtons = allAnswers.map((answer, index) =>
          new ButtonBuilder()
            .setCustomId(`trivia_timeout_${index}`)
            .setLabel(answer.substring(0, 80))
            .setStyle(answer === correctAnswer ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(true)
        );

        const timeoutRows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < timeoutButtons.length; i += 2) {
          timeoutRows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(timeoutButtons.slice(i, i + 2))
          );
        }

        embed.setColor('#FFA500');
        embed.addFields({
          name: '⏰ Time\'s Up!',
          value: `The correct answer was: **${correctAnswer}**`,
          inline: false
        });

        await interaction.editReply({ embeds: [embed], components: timeoutRows });
      }
    } catch (error) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', 'Failed to fetch trivia question. Please try again later.')]
      });
    }
  }
};

function decodeHtml(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&szlig;/g, 'ß');
}

export default command;
