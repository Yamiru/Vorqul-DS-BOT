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
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { UserData } from '../../../../utils/models.js';
import { formatNumber } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

const SPIN_COOLDOWN = 24 * 60 * 60 * 1000;

interface WheelPrize {
  name: string;
  emoji: string;
  coins: number;
  xp: number;
  chance: number;
  color: string;
}

const wheelPrizes: WheelPrize[] = [
  { name: 'JACKPOT', emoji: '💎', coins: 1000, xp: 500, chance: 2, color: '#FFD700' },
  { name: 'Big Win', emoji: '🎰', coins: 500, xp: 250, chance: 5, color: '#FF69B4' },
  { name: 'Nice Prize', emoji: '🎁', coins: 200, xp: 100, chance: 15, color: '#00FF00' },
  { name: 'Small Win', emoji: '🪙', coins: 100, xp: 50, chance: 25, color: '#87CEEB' },
  { name: 'Tiny Prize', emoji: '✨', coins: 50, xp: 25, chance: 30, color: '#DDA0DD' },
  { name: 'Better Luck', emoji: '🍀', coins: 10, xp: 10, chance: 20, color: '#808080' },
  { name: 'Try Again', emoji: '😅', coins: 0, xp: 5, chance: 3, color: '#A0A0A0' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('Spin the daily wheel for prizes!'),

  category: 'economy',
  guildOnly: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    let userData = await UserData.findOne({ odId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId, guildId });
    }

    const lastSpin = userData.lastWheelSpin;
    const now = new Date();

    if (lastSpin) {
      const timeSince = now.getTime() - lastSpin.getTime();
      if (timeSince < SPIN_COOLDOWN) {
        const timeLeft = SPIN_COOLDOWN - timeSince;
        const hours = Math.floor(timeLeft / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);

        await interaction.reply({
          embeds: [
            EmbedHelper.warning(
              '🎡 Wheel Spin',
              `You already spun today!\n\nCome back in **${hours}h ${minutes}m**`
            )
          ],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    const prize = spinWheel();

    await interaction.deferReply();

    const wheelEmojis = ['💎', '🎰', '🎁', '🪙', '✨', '🍀', '😅'];
    let spinDisplay = '';

    for (let i = 0; i < 3; i++) {
      const randomEmojis = wheelEmojis.sort(() => Math.random() - 0.5).slice(0, 3);
      spinDisplay += randomEmojis.join(' ');
      if (i < 2) spinDisplay += '\n';
    }

    const spinEmbed = new EmbedBuilder()
      .setTitle('🎡 Spinning the Wheel...')
      .setDescription('```\n' + spinDisplay + '\n```')
      .setColor('#FFD700');

    await interaction.editReply({ embeds: [spinEmbed] });

    await new Promise(resolve => setTimeout(resolve, 2000));

    userData.totalXp += prize.xp;
    userData.xp += prize.xp;
    userData.lastWheelSpin = now;
    userData.wheelSpins = (userData.wheelSpins || 0) + 1;
    await userData.save();
    await getDatabase().increment('user_data', { balance: prize.coins }, {
      user_id: odId,
      guild_id: guildId
    });
    userData.balance += prize.coins;

    const resultEmbed = new EmbedBuilder()
      .setTitle(`${prize.emoji} ${prize.name}!`)
      .setDescription(
        `The wheel landed on **${prize.name}**!\n\n` +
        `**Rewards:**\n` +
        `💰 ${formatNumber(prize.coins)} coins\n` +
        `✨ ${formatNumber(prize.xp)} XP\n\n` +
        `**Your Balance:** ${formatNumber(userData.balance)} coins`
      )
      .setColor(prize.color as `#${string}`)
      .setFooter({ text: `Spin #${userData.wheelSpins} • Come back tomorrow!` })
      .setTimestamp();

    if (prize.coins >= 500) {
      resultEmbed.setThumbnail('https://i.imgur.com/bPHjk8x.png');
    }

    await interaction.editReply({ embeds: [resultEmbed] });
  }
};

function spinWheel(): WheelPrize {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const prize of wheelPrizes) {
    cumulative += prize.chance;
    if (roll < cumulative) {
      return prize;
    }
  }

  return wheelPrizes[wheelPrizes.length - 1];
}

export default command;
