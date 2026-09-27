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
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { MarketListing, UserData } from '../../../../utils/models.js';
import { formatNumber } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';
import { logger } from '../../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Server marketplace for trading')
    .addSubcommand(sub =>
      sub.setName('browse').setDescription('Browse marketplace listings')
    )
    .addSubcommand(sub =>
      sub
        .setName('sell')
        .setDescription('Create a listing')
        .addStringOption(opt =>
          opt.setName('item').setDescription('Item name').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('price').setDescription('Price in coins').setMinValue(1).setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('description').setDescription('Item description').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('buy')
        .setDescription('Buy a listing')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Listing ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('mylistings').setDescription('View your listings')
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel your listing')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Listing ID').setRequired(true)
        )
    ),

  category: 'economy',

  cooldown: 5,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    switch (subcommand) {
      case 'browse': {
        const allListings = await MarketListing.find({
          guildId,
          status: 'active'
        });

        const listings = allListings
          .sort((a: any, b: any) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime())
          .slice(0, 20);

        if (listings.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Marketplace', 'No active listings. Be the first to sell something!')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🏪 Marketplace')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription('Active listings for sale')
          .setTimestamp();

        for (const listing of listings.slice(0, 10)) {
          embed.addFields({
            name: `${listing.itemName || listing.item_name} - 💰 ${formatNumber(listing.price)}`,
            value: [
              listing.description || 'No description',
              `Seller: <@${listing.sellerId || listing.seller_id}>`,
              `ID: \`${listing._id}\``
            ].join('\n'),
            inline: true
          });
        }

        embed.setFooter({ text: `${listings.length} active listings • Use /market buy <id>` });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'sell': {
        const itemName = interaction.options.getString('item', true);
        const price = interaction.options.getInteger('price', true);
        const description = interaction.options.getString('description');

        const existingCount = await MarketListing.countDocuments({
          guildId,
          sellerId: odId,
          status: 'active'
        });

        if (existingCount >= 10) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You can only have 10 active listings at a time.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const listing = await MarketListing.create({
          guildId,
          sellerId: odId,
          itemName,
          description,
          price,
          status: 'active'
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              '📝 Listing Created',
              `**Item:** ${itemName}\n` +
              `**Price:** 💰 ${formatNumber(price)} coins\n` +
              `**ID:** \`${listing._id}\`\n\n` +
              `Others can now buy your item!`
            )
          ]
        });
        break;
      }

      case 'buy': {
        const listingId = interaction.options.getString('id', true);

        const listing = await MarketListing.findOne({
          _id: listingId,
          guildId,
          status: 'active'
        });

        if (!listing) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Listing not found or no longer available.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (listing.sellerId === odId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You cannot buy your own listing.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const buyerData = await UserData.findOne({ odId, guildId });
        if (!buyerData || buyerData.balance < listing.price) {
          await interaction.reply({
            embeds: [
              EmbedHelper.error(
                'Insufficient Funds',
                `You need ${formatNumber(listing.price)} coins but only have ${formatNumber(buyerData?.balance || 0)}.`
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('market_confirm')
            .setLabel(`Buy for ${formatNumber(listing.price)} coins`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('market_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [
            EmbedHelper.info(
              'Confirm Purchase',
              `**Item:** ${listing.itemName}\n` +
              `**Price:** 💰 ${formatNumber(listing.price)} coins\n` +
              `**Seller:** <@${listing.sellerId}>\n\n` +
              `Are you sure you want to buy this?`
            )
          ],
          components: [row]
        });

        const response = await interaction.fetchReply();

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: i => i.user.id === odId,
            time: 30000,
            componentType: ComponentType.Button
          });

          if (confirmation.customId === 'market_confirm') {
            const claimed = await MarketListing.claimForPurchase(listing._id, odId);
            if (!claimed) {
              await confirmation.update({
                embeds: [EmbedHelper.error('Error', 'This listing was already sold to someone else.')],
                components: []
              });
              return;
            }

            const db = getDatabase();
            const debited = await db.decrementIfAtLeast('user_data', 'balance', listing.price, {
              user_id: odId,
              guild_id: guildId
            });

            if (!debited) {
              await db.update('market_items', { sold: 0, buyer_id: null, sold_at: null }, { id: listing._id });
              await confirmation.update({
                embeds: [EmbedHelper.error('Insufficient Funds', 'Your balance changed and is no longer enough for this purchase.')],
                components: []
              });
              return;
            }

            const sellerId = listing.sellerId || listing.seller_id;
            const sellerData = await UserData.findOne({ odId: sellerId, guildId });
            if (sellerData) {
              await db.increment('user_data', { balance: listing.price }, { user_id: sellerId, guild_id: guildId });
            } else {
              await UserData.create({ odId: sellerId, guildId, balance: listing.price });
            }

            await confirmation.update({
              embeds: [
                EmbedHelper.success(
                  '✅ Purchase Complete!',
                  `You bought **${listing.itemName || listing.item_name}** for ${formatNumber(listing.price)} coins.\n\n` +
                  `Contact <@${listing.sellerId || listing.seller_id}> to arrange delivery.`
                )
              ],
              components: []
            });

            try {
              const seller = await interaction.client.users.fetch(listing.sellerId || listing.seller_id);
              await seller.send({
                embeds: [
                  EmbedHelper.success(
                    '💰 Item Sold!',
                    `Your **${listing.itemName || listing.item_name}** was bought by <@${odId}> for ${formatNumber(listing.price)} coins!\n\n` +
                    `Server: ${interaction.guild!.name}`
                  )
                ]
              });
            } catch (error) {
                logger.debug('market: suppressed error', error);
              }
          } else {
            await confirmation.update({
              embeds: [EmbedHelper.info('Cancelled', 'Purchase cancelled.')],
              components: []
            });
          }
        } catch {
          await interaction.editReply({
            embeds: [EmbedHelper.info('Timeout', 'Purchase cancelled due to timeout.')],
            components: []
          });
        }
        break;
      }

      case 'mylistings': {
        const listings = await MarketListing.find({
          guildId,
          sellerId: odId,
          status: 'active'
        });

        if (listings.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Your Listings', 'You have no active listings.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 Your Listings')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            listings.map((l: any, i: number) =>
              `**${i + 1}.** ${l.itemName || l.item_name}\n` +
              `   Price: 💰 ${formatNumber(l.price)}\n` +
              `   ID: \`${l._id}\``
            ).join('\n\n')
          )
          .setFooter({ text: `${listings.length}/10 listings • Use /market cancel <id>` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'cancel': {
        const listingId = interaction.options.getString('id', true);

        const listing = await MarketListing.findOneAndDelete({
          _id: listingId,
          guildId,
          sellerId: odId,
          status: 'active'
        });

        if (!listing) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Listing not found or not yours.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Cancelled', `Listing for **${listing.itemName || listing.item_name}** has been removed.`)],
          flags: MessageFlags.Ephemeral
        });
        break;
      }
    }
  }
};

export default command;
