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
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { UserData, ModLog } from '../../../../utils/models.js';
import { progressBar } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';

interface HealthMetrics {
  activity: number;
  growth: number;
  retention: number;
  toxicity: number;
  engagement: number;
  overall: number;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('serverhealth')
    .setDescription('View server health score and analytics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const guild = interaction.guild!;
    const guildId = guild.id;

    const metrics = await calculateHealthMetrics(guildId, guild);

    const overallColor = metrics.overall >= 80 ? '#57F287' :
                         metrics.overall >= 60 ? '#FEE75C' :
                         metrics.overall >= 40 ? '#FFA500' : '#ED4245';

    const overallEmoji = metrics.overall >= 80 ? '🟢' :
                         metrics.overall >= 60 ? '🟡' :
                         metrics.overall >= 40 ? '🟠' : '🔴';

    const embed = new EmbedBuilder()
      .setTitle(`${overallEmoji} Server Health Score`)
      .setDescription(
        `# ${metrics.overall}/100\n` +
        `${progressBar(metrics.overall, 100, 20)}\n\n` +
        getHealthStatus(metrics.overall)
      )
      .setColor(overallColor as `#${string}`)
      .addFields(
        {
          name: '📊 Activity Score',
          value: `${getScoreEmoji(metrics.activity)} ${metrics.activity}/100\n${progressBar(metrics.activity, 100, 10)}`,
          inline: true
        },
        {
          name: '📈 Growth Score',
          value: `${getScoreEmoji(metrics.growth)} ${metrics.growth}/100\n${progressBar(metrics.growth, 100, 10)}`,
          inline: true
        },
        {
          name: '🔄 Retention Score',
          value: `${getScoreEmoji(metrics.retention)} ${metrics.retention}/100\n${progressBar(metrics.retention, 100, 10)}`,
          inline: true
        },
        {
          name: '🛡️ Safety Score',
          value: `${getScoreEmoji(100 - metrics.toxicity)} ${100 - metrics.toxicity}/100\n${progressBar(100 - metrics.toxicity, 100, 10)}`,
          inline: true
        },
        {
          name: '💬 Engagement Score',
          value: `${getScoreEmoji(metrics.engagement)} ${metrics.engagement}/100\n${progressBar(metrics.engagement, 100, 10)}`,
          inline: true
        },
        {
          name: '📋 Recommendations',
          value: getRecommendations(metrics),
          inline: false
        }
      )
      .setFooter({ text: 'Updated just now • Scores based on last 7 days' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

async function calculateHealthMetrics(guildId: string, guild: any): Promise<HealthMetrics> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const activeUsers = await UserData.countDocuments({
    guildId,
    updatedAt: { $gte: weekAgo }
  });
  const totalMembers = guild.memberCount;
  const activityRatio = Math.min(activeUsers / Math.max(totalMembers * 0.3, 1), 1);
  const activity = Math.round(activityRatio * 100);

  const recentJoins = guild.members.cache.filter(
    (m: any) => m.joinedTimestamp && m.joinedTimestamp > weekAgo.getTime()
  ).size;
  const expectedGrowth = Math.max(totalMembers * 0.05, 5);
  const growthRatio = Math.min(recentJoins / expectedGrowth, 1);
  const growth = Math.round(growthRatio * 100);

  const previousActiveUsers = await UserData.countDocuments({
    guildId,
    updatedAt: { $gte: twoWeeksAgo, $lt: weekAgo }
  });
  const retentionRatio = previousActiveUsers > 0
    ? Math.min(activeUsers / previousActiveUsers, 1.5) / 1.5
    : 0.5;
  const retention = Math.round(retentionRatio * 100);

  const modActions = await ModLog.countDocuments({
    guildId,
    createdAt: { $gte: weekAgo }
  });
  const toxicityRatio = Math.min(modActions / Math.max(totalMembers * 0.1, 10), 1);
  const toxicity = Math.round(toxicityRatio * 100);

  const xpGained = await UserData.aggregate([
    { $match: { guildId, updatedAt: { $gte: weekAgo } } },
    { $group: { _id: null, total: { $sum: '$totalXp' } } }
  ]);
  const totalXp = xpGained[0]?.total || 0;
  const expectedXp = totalMembers * 500;
  const engagementRatio = Math.min(totalXp / Math.max(expectedXp, 1000), 1);
  const engagement = Math.round(engagementRatio * 100);

  const overall = Math.round(
    activity * 0.25 +
    growth * 0.15 +
    retention * 0.25 +
    (100 - toxicity) * 0.15 +
    engagement * 0.20
  );

  return { activity, growth, retention, toxicity, engagement, overall };
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  if (score >= 40) return '🟠';
  return '🔴';
}

function getHealthStatus(score: number): string {
  if (score >= 80) {
    return '✨ **Excellent!** Your community is thriving!';
  } else if (score >= 60) {
    return '👍 **Good!** Your community is healthy with room for improvement.';
  } else if (score >= 40) {
    return '⚠️ **Needs Attention.** Some areas require focus.';
  } else {
    return '🚨 **Critical.** Immediate action needed to improve community health.';
  }
}

function getRecommendations(metrics: HealthMetrics): string {
  const recs: string[] = [];

  if (metrics.activity < 50) {
    recs.push('• Host events or activities to boost engagement');
  }
  if (metrics.growth < 50) {
    recs.push('• Promote your server on listing sites');
  }
  if (metrics.retention < 50) {
    recs.push('• Create welcome flows and onboarding');
  }
  if (metrics.toxicity > 30) {
    recs.push('• Review and strengthen moderation rules');
  }
  if (metrics.engagement < 50) {
    recs.push('• Add interactive features like leveling and quests');
  }

  if (recs.length === 0) {
    return '✅ Keep up the great work! No critical issues detected.';
  }

  return recs.slice(0, 3).join('\n');
}

export default command;
