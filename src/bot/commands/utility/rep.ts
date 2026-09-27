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
import { UserData, ReputationLog, GuildSettings } from '../../../utils/models.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const REP_COOLDOWN = 12 * 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Reputation system')
    .addSubcommand(sub =>
      sub
        .setName('give')
        .setDescription('Give positive reputation to someone')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to give rep').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for rep').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove reputation from someone')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove rep from').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('check')
        .setDescription('Check reputation')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to check').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard').setDescription('View reputation leaderboard')
    ),

  category: 'utility',

  cooldown: 10,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    const settings = await GuildSettings.findOne({ guildId });
    const repCfg: any = (settings as any)?.reputation || {};
    const cooldownMs = repCfg.cooldownHours ? repCfg.cooldownHours * 60 * 60 * 1000 : REP_COOLDOWN;

    switch (subcommand) {
      case 'give':
      case 'remove': {
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason';
        const isPositive = subcommand === 'give';

        if (!isPositive && repCfg.allowNegative === false) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Disabled', 'Negative reputation is turned off on this server.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (targetUser.id === odId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You cannot give reputation to yourself.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (targetUser.bot) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You cannot give reputation to bots.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const repLogs = await ReputationLog.find({
          guildId,
          fromId: odId,
          toId: targetUser.id
        });
        const sortedLogs = repLogs.sort((a: any, b: any) =>
          new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime()
        );
        const lastRep = sortedLogs[0] || null;

        if (lastRep) {
          const repTime = new Date(lastRep.createdAt || lastRep.created_at).getTime();
          const timeSince = Date.now() - repTime;
          if (timeSince < cooldownMs) {
            const hoursLeft = Math.ceil((cooldownMs - timeSince) / 3600000);
            await interaction.reply({
              embeds: [
                EmbedHelper.warning(
                  'Cooldown',
                  `You can give/remove rep to this user again in **${hoursLeft} hours**.`
                )
              ],
              flags: MessageFlags.Ephemeral
            });
            return;
          }
        }

        const change = isPositive ? 1 : -1;
        await UserData.findOneAndUpdate(
          { odId: targetUser.id, guildId },
          { $inc: { reputation: change } },
          { upsert: true }
        );

        await ReputationLog.create({
          guildId,
          fromId: odId,
          toId: targetUser.id,
          type: isPositive ? 'positive' : 'negative',
          reason
        });

        const userData = await UserData.findOne({ odId: targetUser.id, guildId });

        if (isPositive && repCfg.rewardRole && (repCfg.rewardThreshold || 0) > 0 && (userData?.reputation || 0) >= repCfg.rewardThreshold) {
          try {
            const member = await interaction.guild!.members.fetch(targetUser.id);
            if (!member.roles.cache.has(repCfg.rewardRole)) await member.roles.add(repCfg.rewardRole);
          } catch (error) {
              logger.debug('rep: suppressed error', error);
            }
        }

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              isPositive ? '👍 +Rep Given!' : '👎 -Rep Given!',
              `${isPositive ? 'Gave' : 'Removed'} reputation ${isPositive ? 'to' : 'from'} ${targetUser}\n` +
              `**Reason:** ${reason}\n\n` +
              `Their reputation is now: **${userData?.reputation || 0}**`
            )
          ]
        });
        break;
      }

      case 'check': {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = await UserData.findOne({ odId: targetUser.id, guildId });
        const reputation = userData?.reputation || 0;

        const positiveCount = await ReputationLog.countDocuments({
          guildId,
          toId: targetUser.id,
          type: 'positive'
        });

        const negativeCount = await ReputationLog.countDocuments({
          guildId,
          toId: targetUser.id,
          type: 'negative'
        });

        const rank = await UserData.countDocuments({
          guildId,
          reputation: { $gt: reputation }
        }) + 1;

        let statusEmoji: string;
        let statusText: string;
        if (reputation >= 50) { statusEmoji = '🌟'; statusText = 'Legendary'; }
        else if (reputation >= 25) { statusEmoji = '⭐'; statusText = 'Excellent'; }
        else if (reputation >= 10) { statusEmoji = '👍'; statusText = 'Good'; }
        else if (reputation >= 0) { statusEmoji = '😐'; statusText = 'Neutral'; }
        else if (reputation >= -10) { statusEmoji = '😕'; statusText = 'Poor'; }
        else { statusEmoji = '💀'; statusText = 'Terrible'; }

        const embed = new EmbedBuilder()
          .setTitle(`${statusEmoji} ${targetUser.username}'s Reputation`)
          .setThumbnail(targetUser.displayAvatarURL())
          .setColor(reputation >= 0 ? '#57F287' : '#ED4245')
          .addFields(
            { name: '📊 Total Rep', value: `${reputation >= 0 ? '+' : ''}${reputation}`, inline: true },
            { name: '🏆 Rank', value: `#${rank}`, inline: true },
            { name: '📈 Status', value: statusText, inline: true },
            { name: '👍 Positive', value: `${positiveCount}`, inline: true },
            { name: '👎 Negative', value: `${negativeCount}`, inline: true },
            { name: '📅 Total Votes', value: `${positiveCount + negativeCount}`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'leaderboard': {
        const users = await UserData.find({ guildId }, { sort: { reputation: -1 }, limit: 10 });

        if (users.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Reputation', 'No reputation data yet.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('⭐ Reputation Leaderboard')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            users.map((u: any, i: number) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
              const rep = u.reputation || 0;
              return `${medal} <@${u.user_id || u.odId}> - ${rep >= 0 ? '+' : ''}${rep} rep`;
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
