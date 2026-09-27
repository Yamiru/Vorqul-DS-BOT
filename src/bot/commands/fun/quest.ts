/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { UserQuest } from '../../../utils/models.js';
import { formatNumber, progressBar } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Server quests and challenges')
    .addSubcommand(sub =>
      sub.setName('daily').setDescription('View daily quests')
    )
    .addSubcommand(sub =>
      sub.setName('weekly').setDescription('View weekly quests')
    )
    .addSubcommand(sub =>
      sub.setName('claim').setDescription('Claim completed quest rewards')
    )
    .addSubcommand(sub =>
      sub.setName('progress').setDescription('View your quest progress')
    ),

  category: 'fun',
  guildOnly: true,
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    let userQuest = await UserQuest.findOne({ odId, guildId });
    if (!userQuest) {
      userQuest = await UserQuest.create({ odId, guildId });
    }

    const now = new Date();
    const lastDaily = userQuest.lastDailyReset;
    if (!lastDaily || now.getDate() !== lastDaily.getDate()) {
      userQuest.dailyProgress = {};
      userQuest.lastDailyReset = now;
      await userQuest.save();
    }

    const lastWeekly = userQuest.lastWeeklyReset;
    const weekStart = getWeekStart(now);
    if (!lastWeekly || lastWeekly < weekStart) {
      userQuest.weeklyProgress = {};
      userQuest.lastWeeklyReset = now;
      await userQuest.save();
    }

    switch (subcommand) {
      case 'daily': {
        const dailyQuests = getDailyQuests();
        const embed = new EmbedBuilder()
          .setTitle('📋 Daily Quests')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription('Complete quests to earn rewards!')
          .setFooter({ text: 'Resets daily at midnight UTC' })
          .setTimestamp();

        for (const quest of dailyQuests) {
          const progress = userQuest.dailyProgress[quest.id] || 0;
          const completed = progress >= quest.goal;
          const claimed = userQuest.claimedQuests.includes(`daily_${quest.id}_${now.toDateString()}`);

          embed.addFields({
            name: `${completed ? '✅' : '⬜'} ${quest.name}`,
            value: [
              quest.description,
              `Progress: ${progressBar(progress, quest.goal, 10)} ${progress}/${quest.goal}`,
              `Reward: 💰 ${formatNumber(quest.reward.coins)} coins, ✨ ${formatNumber(quest.reward.xp)} XP`,
              claimed ? '🎁 Claimed!' : (completed ? '🎁 Ready to claim!' : '')
            ].filter(Boolean).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'weekly': {
        const weeklyQuests = getWeeklyQuests();
        const embed = new EmbedBuilder()
          .setTitle('📅 Weekly Quests')
          .setColor('#FFD700')
          .setDescription('Bigger challenges, bigger rewards!')
          .setFooter({ text: 'Resets every Monday at midnight UTC' })
          .setTimestamp();

        for (const quest of weeklyQuests) {
          const progress = userQuest.weeklyProgress[quest.id] || 0;
          const completed = progress >= quest.goal;
          const weekKey = `weekly_${quest.id}_${getWeekStart(now).toDateString()}`;
          const claimed = userQuest.claimedQuests.includes(weekKey);

          embed.addFields({
            name: `${completed ? '✅' : '⬜'} ${quest.name}`,
            value: [
              quest.description,
              `Progress: ${progressBar(progress, quest.goal, 10)} ${progress}/${quest.goal}`,
              `Reward: 💰 ${formatNumber(quest.reward.coins)} coins, ✨ ${formatNumber(quest.reward.xp)} XP`,
              claimed ? '🎁 Claimed!' : (completed ? '🎁 Ready to claim!' : '')
            ].filter(Boolean).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'claim': {
        const dailyQuests = getDailyQuests();
        const weeklyQuests = getWeeklyQuests();
        let totalCoins = 0;
        let totalXp = 0;
        let claimedCount = 0;

        for (const quest of dailyQuests) {
          const progress = userQuest.dailyProgress[quest.id] || 0;
          const claimKey = `daily_${quest.id}_${now.toDateString()}`;

          if (progress >= quest.goal && !userQuest.claimedQuests.includes(claimKey)) {
            totalCoins += quest.reward.coins;
            totalXp += quest.reward.xp;
            userQuest.claimedQuests.push(claimKey);
            claimedCount++;
          }
        }

        for (const quest of weeklyQuests) {
          const progress = userQuest.weeklyProgress[quest.id] || 0;
          const claimKey = `weekly_${quest.id}_${getWeekStart(now).toDateString()}`;

          if (progress >= quest.goal && !userQuest.claimedQuests.includes(claimKey)) {
            totalCoins += quest.reward.coins;
            totalXp += quest.reward.xp;
            userQuest.claimedQuests.push(claimKey);
            claimedCount++;
          }
        }

        if (claimedCount === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('No Rewards', 'No completed quests to claim.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        userQuest.totalCoinsEarned += totalCoins;
        userQuest.totalXpEarned += totalXp;
        userQuest.questsCompleted += claimedCount;

        if (userQuest.claimedQuests.length > 100) {
          userQuest.claimedQuests = userQuest.claimedQuests.slice(-100);
        }

        await userQuest.save();

        const { UserData } = await import('../../../utils/models.js');
        await UserData.findOneAndUpdate(
          { odId, guildId },
          {
            $inc: {
              balance: totalCoins,
              totalXp: totalXp,
              xp: totalXp
            }
          },
          { upsert: true }
        );

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              '🎁 Rewards Claimed!',
              `**Quests Completed:** ${claimedCount}\n` +
              `**Coins Earned:** 💰 ${formatNumber(totalCoins)}\n` +
              `**XP Earned:** ✨ ${formatNumber(totalXp)}`
            )
          ]
        });
        break;
      }

      case 'progress': {
        const embed = new EmbedBuilder()
          .setTitle(`📊 ${interaction.user.username}'s Quest Progress`)
          .setColor(config.bot.embedColor as `#${string}`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            { name: '🏆 Quests Completed', value: formatNumber(userQuest.questsCompleted), inline: true },
            { name: '💰 Total Coins Earned', value: formatNumber(userQuest.totalCoinsEarned), inline: true },
            { name: '✨ Total XP Earned', value: formatNumber(userQuest.totalXpEarned), inline: true },
            { name: '🔥 Current Streak', value: `${userQuest.questStreak} days`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  }
};

interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  goal: number;
  reward: { coins: number; xp: number };
}

function getDailyQuests(): QuestDefinition[] {
  return [
    { id: 'messages', name: 'Chat Champion', description: 'Send 30 messages', goal: 30, reward: { coins: 50, xp: 100 } },
    { id: 'reactions', name: 'React Master', description: 'Add 10 reactions', goal: 10, reward: { coins: 25, xp: 50 } },
    { id: 'voice', name: 'Voice Warrior', description: 'Spend 10 minutes in voice', goal: 10, reward: { coins: 75, xp: 150 } },
    { id: 'commands', name: 'Bot Friend', description: 'Use 5 bot commands', goal: 5, reward: { coins: 30, xp: 60 } }
  ];
}

function getWeeklyQuests(): QuestDefinition[] {
  return [
    { id: 'messages_weekly', name: 'Chat Legend', description: 'Send 200 messages', goal: 200, reward: { coins: 500, xp: 1000 } },
    { id: 'invites', name: 'Community Builder', description: 'Invite 2 new members', goal: 2, reward: { coins: 300, xp: 600 } },
    { id: 'voice_weekly', name: 'Voice Champion', description: 'Spend 60 minutes in voice', goal: 60, reward: { coins: 400, xp: 800 } },
    { id: 'daily_streak', name: 'Dedicated', description: 'Claim daily reward 5 times', goal: 5, reward: { coins: 250, xp: 500 } }
  ];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default command;
