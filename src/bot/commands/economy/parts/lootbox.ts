/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { UserData } from '../../../../utils/models.js';
import { formatNumber, randomInt } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

interface LootBoxType {
  id: string;
  name: string;
  emoji: string;
  price: number;
  color: string;
  rewards: LootReward[];
}

interface LootReward {
  name: string;
  emoji: string;
  coins: { min: number; max: number };
  xp: { min: number; max: number };
  chance: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

const lootBoxes: LootBoxType[] = [
  {
    id: 'basic',
    name: 'Basic Box',
    emoji: '📦',
    price: 100,
    color: '#808080',
    rewards: [
      { name: 'Small Coins', emoji: '🪙', coins: { min: 50, max: 100 }, xp: { min: 10, max: 25 }, chance: 50, rarity: 'common' },
      { name: 'Medium Coins', emoji: '💰', coins: { min: 100, max: 200 }, xp: { min: 25, max: 50 }, chance: 30, rarity: 'uncommon' },
      { name: 'Big Coins', emoji: '💎', coins: { min: 200, max: 400 }, xp: { min: 50, max: 100 }, chance: 15, rarity: 'rare' },
      { name: 'Jackpot!', emoji: '🎰', coins: { min: 500, max: 1000 }, xp: { min: 100, max: 200 }, chance: 5, rarity: 'epic' }
    ]
  },
  {
    id: 'premium',
    name: 'Premium Box',
    emoji: '🎁',
    price: 500,
    color: '#FFD700',
    rewards: [
      { name: 'Gold Stack', emoji: '💰', coins: { min: 200, max: 400 }, xp: { min: 50, max: 100 }, chance: 40, rarity: 'uncommon' },
      { name: 'Treasure', emoji: '💎', coins: { min: 400, max: 800 }, xp: { min: 100, max: 200 }, chance: 35, rarity: 'rare' },
      { name: 'Royal Fortune', emoji: '👑', coins: { min: 800, max: 1500 }, xp: { min: 200, max: 400 }, chance: 20, rarity: 'epic' },
      { name: 'LEGENDARY!', emoji: '🌟', coins: { min: 2000, max: 5000 }, xp: { min: 500, max: 1000 }, chance: 5, rarity: 'legendary' }
    ]
  },
  {
    id: 'mystery',
    name: 'Mystery Box',
    emoji: '❓',
    price: 250,
    color: '#9B59B6',
    rewards: [
      { name: 'Nothing...', emoji: '💨', coins: { min: 0, max: 0 }, xp: { min: 5, max: 10 }, chance: 10, rarity: 'common' },
      { name: 'Surprise!', emoji: '🎉', coins: { min: 100, max: 300 }, xp: { min: 25, max: 75 }, chance: 40, rarity: 'uncommon' },
      { name: 'Lucky Find', emoji: '🍀', coins: { min: 300, max: 600 }, xp: { min: 75, max: 150 }, chance: 30, rarity: 'rare' },
      { name: 'Hidden Gem', emoji: '💠', coins: { min: 600, max: 1200 }, xp: { min: 150, max: 300 }, chance: 15, rarity: 'epic' },
      { name: 'ULTRA RARE!', emoji: '🔮', coins: { min: 2500, max: 7500 }, xp: { min: 400, max: 800 }, chance: 5, rarity: 'legendary' }
    ]
  }
];

const rarityColors: Record<string, string> = {
  common: '#9E9E9E',
  uncommon: '#4CAF50',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800'
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lootbox')
    .setDescription('Buy and open loot boxes')
    .addSubcommand(sub =>
      sub.setName('shop').setDescription('View available loot boxes')
    )
    .addSubcommand(sub =>
      sub
        .setName('buy')
        .setDescription('Buy a loot box')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Box type')
            .setRequired(true)
            .addChoices(
              { name: '📦 Basic Box (100 coins)', value: 'basic' },
              { name: '🎁 Premium Box (500 coins)', value: 'premium' },
              { name: '❓ Mystery Box (250 coins)', value: 'mystery' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('inventory').setDescription('View your loot boxes')
    )
    .addSubcommand(sub =>
      sub
        .setName('open')
        .setDescription('Open a loot box')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Box type to open')
            .setRequired(true)
            .addChoices(
              { name: '📦 Basic Box', value: 'basic' },
              { name: '🎁 Premium Box', value: 'premium' },
              { name: '❓ Mystery Box', value: 'mystery' }
            )
        )
    ),

  category: 'economy',
  guildOnly: true,
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    let userData = await UserData.findOne({ odId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId, guildId });
    }

    switch (subcommand) {
      case 'shop': {
        const embed = new EmbedBuilder()
          .setTitle('🎁 Loot Box Shop')
          .setDescription('Buy loot boxes for a chance at amazing rewards!')
          .setColor('#FFD700');

        for (const box of lootBoxes) {
          const rarityList = box.rewards
            .map(r => `${r.emoji} ${r.rarity.charAt(0).toUpperCase() + r.rarity.slice(1)} (${r.chance}%)`)
            .join('\n');

          embed.addFields({
            name: `${box.emoji} ${box.name} - ${formatNumber(box.price)} coins`,
            value: `**Possible Rewards:**\n${rarityList}`,
            inline: true
          });
        }

        embed.setFooter({ text: `Your balance: ${formatNumber(userData.balance)} coins` });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'buy': {
        const boxType = interaction.options.getString('type', true);
        const box = lootBoxes.find(b => b.id === boxType);

        if (!box) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Invalid box type.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (userData.balance < box.price) {
          await interaction.reply({
            embeds: [
              EmbedHelper.error(
                'Insufficient Funds',
                `You need ${formatNumber(box.price)} coins but only have ${formatNumber(userData.balance)}.`
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const paid = await getDatabase().decrementIfAtLeast(
          'user_data',
          'balance',
          box.price,
          { user_id: odId, guild_id: guildId }
        );

        if (!paid) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You no longer have enough coins for this box.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        userData.balance -= box.price;
        if (!userData.lootBoxes) userData.lootBoxes = {};
        userData.lootBoxes[boxType] = (userData.lootBoxes[boxType] || 0) + 1;
        await userData.save();

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Purchase Complete!',
              `You bought a ${box.emoji} **${box.name}**!\n\n` +
              `Use \`/lootbox open\` to open it.\n` +
              `**New Balance:** ${formatNumber(userData.balance)} coins`
            )
          ]
        });
        break;
      }

      case 'inventory': {
        const boxes = userData.lootBoxes || {};
        const totalBoxes = Object.values(boxes).reduce((a: number, b: any) => a + (b || 0), 0);

        if (totalBoxes === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Inventory', 'You don\'t have any loot boxes. Buy some from `/lootbox shop`!')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 Your Loot Boxes')
          .setColor('#5865F2')
          .setDescription(
            lootBoxes
              .filter(b => boxes[b.id] > 0)
              .map(b => `${b.emoji} **${b.name}:** ${boxes[b.id]}`)
              .join('\n')
          )
          .setFooter({ text: `Total: ${totalBoxes} boxes` });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'open': {
        const boxType = interaction.options.getString('type', true);
        const box = lootBoxes.find(b => b.id === boxType);

        if (!box) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Invalid box type.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const boxes = userData.lootBoxes || {};
        if (!boxes[boxType] || boxes[boxType] <= 0) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', `You don't have any ${box.name}s.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.deferReply();

        const openingEmbed = new EmbedBuilder()
          .setTitle(`${box.emoji} Opening ${box.name}...`)
          .setDescription('✨ 🎁 ✨')
          .setColor(box.color as `#${string}`);

        await interaction.editReply({ embeds: [openingEmbed] });
        await new Promise(r => setTimeout(r, 2000));

        const reward = rollReward(box.rewards);
        const coinsWon = randomInt(reward.coins.min, reward.coins.max);
        const xpWon = randomInt(reward.xp.min, reward.xp.max);

        boxes[boxType]--;
        userData.lootBoxes = boxes;
        userData.xp += xpWon;
        userData.totalXp += xpWon;
        await userData.save();
        await getDatabase().increment('user_data', { balance: coinsWon }, {
          user_id: odId,
          guild_id: guildId
        });
        userData.balance += coinsWon;

        const resultEmbed = new EmbedBuilder()
          .setTitle(`${reward.emoji} ${reward.name}`)
          .setDescription(
            `**Rarity:** ${reward.rarity.toUpperCase()}\n\n` +
            `**Rewards:**\n` +
            `💰 ${formatNumber(coinsWon)} coins\n` +
            `✨ ${formatNumber(xpWon)} XP\n\n` +
            `**New Balance:** ${formatNumber(userData.balance)} coins`
          )
          .setColor(rarityColors[reward.rarity] as `#${string}`)
          .setTimestamp();

        if (reward.rarity === 'legendary') {
          resultEmbed.setThumbnail('https://i.imgur.com/legendary.png');
        }

        await interaction.editReply({ embeds: [resultEmbed] });
        break;
      }
    }
  }
};

function rollReward(rewards: LootReward[]): LootReward {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const reward of rewards) {
    cumulative += reward.chance;
    if (roll < cumulative) {
      return reward;
    }
  }

  return rewards[0];
}

export default command;
