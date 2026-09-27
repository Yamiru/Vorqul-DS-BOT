/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { formatNumber } from '../../../../utils/helpers.js';
import config from '../../../../config/config.json' with { type: 'json' };
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  type: 'role' | 'item' | 'boost';
  roleId?: string;
  duration?: number;
}

const DEFAULT_SHOP: ShopItem[] = [
  { id: 'vip_role', name: 'VIP Role', description: 'Get the VIP role for 30 days', price: 5000, emoji: '👑', type: 'role' },
  { id: 'xp_boost', name: '2x XP Boost', description: 'Double XP for 24 hours', price: 2000, emoji: '⚡', type: 'boost', duration: 24 },
  { id: 'custom_color', name: 'Custom Color', description: 'Custom name color', price: 3000, emoji: '🎨', type: 'item' },
  { id: 'nickname', name: 'Nickname Change', description: 'Nickname change', price: 1000, emoji: '📝', type: 'item' },
  { id: 'lootbox_basic', name: 'Basic Lootbox', description: 'Basic lootbox', price: 100, emoji: '📦', type: 'item' },
  { id: 'lootbox_premium', name: 'Premium Lootbox', description: 'Premium lootbox', price: 500, emoji: '🎁', type: 'item' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Server shop')
    .addSubcommand(sub =>
      sub.setName('browse').setDescription('Browse the shop')
    )
    .addSubcommand(sub =>
      sub
        .setName('buy')
        .setDescription('Buy an item')
        .addStringOption(opt =>
          opt
            .setName('item')
            .setDescription('Item to buy')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('inventory').setDescription('View your inventory')
    ),

  category: 'economy',

  cooldown: 5,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    const settings = await GuildSettings.findOne({ guildId });
    const currencyEmoji = settings?.economy?.currencyEmoji || '💰';
    const currencyName = settings?.economy?.currencyName || 'coins';

    let userData = await UserData.findOne({ odId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId, guildId });
    }

    const shopItems = (settings as any)?.shop?.items || DEFAULT_SHOP;

    switch (subcommand) {
      case 'browse': {
        const embed = new EmbedBuilder()
          .setTitle('🛒 Server Shop')
          .setDescription(`Tvoj balance: ${currencyEmoji} **${formatNumber(userData.balance)}** ${currencyName}`)
          .setColor(config.bot.embedColor as `#${string}`)
          .setTimestamp();

        for (const item of shopItems) {
          const canAfford = userData.balance >= item.price;
          embed.addFields({
            name: `${item.emoji} ${item.name} - ${currencyEmoji} ${formatNumber(item.price)}`,
            value: `${item.description}\n${canAfford ? '✅ Available' : '❌ Not enough money'}`,
            inline: true
          });
        }

        embed.setFooter({ text: 'Use /shop buy <item> to buy' });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'buy': {
        const itemId = interaction.options.getString('item', true);
        const item = shopItems.find((i: ShopItem) => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());

        if (!item) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Item not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (userData.balance < item.price) {
          await interaction.reply({
            embeds: [
              EmbedHelper.error(
                'Insufficient Funds',
                `You need ${currencyEmoji} ${formatNumber(item.price)} ${currencyName}, but you only have ${currencyEmoji} ${formatNumber(userData.balance)}.`
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const paid = await getDatabase().decrementIfAtLeast(
          'user_data',
          'balance',
          item.price,
          { user_id: odId, guild_id: guildId }
        );

        if (!paid) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You no longer have enough coins for this item.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        userData.balance -= item.price;

        let successMessage = '';

        switch (item.type) {
          case 'role':
            if (item.roleId) {
              try {
                const member = await interaction.guild!.members.fetch(odId);
                await member.roles.add(item.roleId);
                successMessage = `Dostal si rolu <@&${item.roleId}>!`;
              } catch {
                successMessage = 'Role purchased (contact an admin for activation).';
              }
            }
            break;

          case 'boost':

            if (!userData.inventory) userData.inventory = [];
            userData.inventory.push({
              itemId: item.id,
              quantity: 1,
              expiresAt: new Date(Date.now() + (item.duration || 24) * 60 * 60 * 1000)
            } as any);
            successMessage = `${item.name} was activated for ${item.duration} hours!`;
            break;

          case 'item': {
            if (!userData.inventory) userData.inventory = [];
            const existingItem = userData.inventory.find((i: any) => i.itemId === item.id);
            if (existingItem) {
              existingItem.quantity++;
            } else {
              userData.inventory.push({ itemId: item.id, quantity: 1 });
            }
            successMessage = `${item.name} was added to your inventory!`;

            if (item.id.includes('lootbox')) {
              if (!userData.lootBoxes) userData.lootBoxes = {};
              const boxType = item.id.replace('lootbox_', '');
              userData.lootBoxes[boxType] = (userData.lootBoxes[boxType] || 0) + 1;
              successMessage = `${item.name} was added! Use /lootbox open to open it.`;
            }
            break;
          }
        }

        await userData.save();

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              '🛒 Purchase Complete!',
              `You bought **${item.emoji} ${item.name}**!\n\n${successMessage}\n\n` +
              `**New balance:** ${currencyEmoji} ${formatNumber(userData.balance)} ${currencyName}`
            )
          ]
        });
        break;
      }

      case 'inventory': {
        const inventory = userData.inventory || [];

        if (inventory.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Inventory', 'Your inventory is empty.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
          .setColor(config.bot.embedColor as `#${string}`)
          .setTimestamp();

        const itemGroups = new Map<string, number>();
        for (const inv of inventory) {
          const item = shopItems.find((i: ShopItem) => i.id === inv.itemId);
          if (item) {
            const current = itemGroups.get(item.id) || 0;
            itemGroups.set(item.id, current + inv.quantity);
          }
        }

        const itemList = Array.from(itemGroups.entries()).map(([itemId, qty]) => {
          const item = shopItems.find((i: ShopItem) => i.id === itemId);
          return item ? `${item.emoji} **${item.name}** x${qty}` : null;
        }).filter(Boolean).join('\n');

        embed.setDescription(itemList || 'Empty');

        if (userData.lootBoxes && Object.keys(userData.lootBoxes).length > 0) {
          const lootboxList = Object.entries(userData.lootBoxes)
            .filter(([_, qty]) => (qty as number) > 0)
            .map(([type, qty]) => `📦 ${type.charAt(0).toUpperCase() + type.slice(1)} Lootbox x${qty}`)
            .join('\n');

          if (lootboxList) {
            embed.addFields({ name: '📦 Lootboxy', value: lootboxList, inline: false });
          }
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }
    }
  }
};

export default command;
