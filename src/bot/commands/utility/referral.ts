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
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { Referral, UserData } from '../../../utils/models.js';
import { formatNumber } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const REFERRAL_REWARD = 500;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('referral')
    .setDescription('Referral system')
    .addSubcommand(sub =>
      sub.setName('code').setDescription('Get your referral code')
    )
    .addSubcommand(sub =>
      sub
        .setName('use')
        .setDescription('Use a referral code')
        .addStringOption(opt =>
          opt.setName('code').setDescription('Referral code').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stats').setDescription('View your referral stats')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('Top referrers')
    ),

  category: 'utility',

  cooldown: 10,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    switch (subcommand) {
      case 'code': {
        const code = `${guildId.slice(-4)}-${odId.slice(-6)}`.toUpperCase();

        const embed = new EmbedBuilder()
          .setTitle('🔗 Your Referral Code')
          .setDescription(
            `Share this code with friends!\n\n` +
            `**Code:** \`${code}\`\n\n` +
            `When someone uses your code, you both get **${formatNumber(REFERRAL_REWARD)} coins**!`
          )
          .setColor(config.bot.embedColor as `#${string}`)
          .setFooter({ text: 'New members can use /referral use <code>' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'use': {
        const code = interaction.options.getString('code', true).toUpperCase();

        const guildPart = code.split('-')[0];
        const userPart = code.split('-')[1];

        if (!userPart || guildPart !== guildId.slice(-4).toUpperCase()) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Invalid Code', 'This referral code is invalid or for another server.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const referrerId = interaction.guild!.members.cache.find(
          m => m.id.slice(-6).toUpperCase() === userPart
        )?.id;

        if (!referrerId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Invalid Code', 'Could not find the referrer.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (referrerId === odId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You cannot use your own referral code.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const existingReferral = await Referral.findOne({ guildId, referredId: odId });
        if (existingReferral) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You have already used a referral code.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const member = await interaction.guild!.members.fetch(odId);
        const joinedDaysAgo = (Date.now() - (member.joinedTimestamp || 0)) / (1000 * 60 * 60 * 24);

        if (joinedDaysAgo > 7) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Referral codes can only be used within 7 days of joining.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await Referral.create({
          guildId,
          referrerId,
          referredId: odId,
          code,
          rewardClaimed: true
        });

        await UserData.findOneAndUpdate(
          { odId: referrerId, guildId },
          { $inc: { balance: REFERRAL_REWARD } },
          { upsert: true }
        );

        await UserData.findOneAndUpdate(
          { odId, guildId },
          { $inc: { balance: REFERRAL_REWARD } },
          { upsert: true }
        );

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              '🎉 Referral Bonus!',
              `You used <@${referrerId}>'s referral code!\n\n` +
              `**You received:** 💰 ${formatNumber(REFERRAL_REWARD)} coins\n` +
              `**They received:** 💰 ${formatNumber(REFERRAL_REWARD)} coins`
            )
          ]
        });

        try {
          const referrer = await interaction.client.users.fetch(referrerId);
          await referrer.send({
            embeds: [
              EmbedHelper.success(
                '🎉 Referral Bonus!',
                `${interaction.user.tag} used your referral code in **${interaction.guild!.name}**!\n\n` +
                `**You received:** 💰 ${formatNumber(REFERRAL_REWARD)} coins`
              )
            ]
          });
        } catch (error) {
            logger.debug('referral: suppressed error', error);
          }
        break;
      }

      case 'stats': {
        const referrals = await Referral.find({ guildId, referrerId: odId });
        const totalEarned = referrals.length * REFERRAL_REWARD;

        const embed = new EmbedBuilder()
          .setTitle('📊 Your Referral Stats')
          .setColor(config.bot.embedColor as `#${string}`)
          .addFields(
            { name: '👥 Total Referrals', value: `${referrals.length}`, inline: true },
            { name: '💰 Total Earned', value: `${formatNumber(totalEarned)} coins`, inline: true }
          )
          .setTimestamp();

        if (referrals.length > 0) {
          const recentReferrals = referrals.slice(-5).reverse();
          embed.addFields({
            name: '📋 Recent Referrals',
            value: recentReferrals.map(r => `<@${r.referredId}>`).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'leaderboard': {
        const referralCounts = await Referral.aggregate([
          { $match: { guildId } },
          { $group: { _id: '$referrerId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]);

        if (referralCounts.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Referrals', 'No referrals yet.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Top Referrers')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            referralCounts.map((r, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
              return `${medal} <@${r._id}> - ${r.count} referrals`;
            }).join('\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  }
};

export default command;
