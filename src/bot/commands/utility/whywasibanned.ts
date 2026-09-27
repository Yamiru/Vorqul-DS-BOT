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
import { ModLog, GuildSettings } from '../../../utils/models.js';
import { resolveAppealInfo } from '../../../shared/featureConfig.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('whywasibanned')
    .setDescription('Check your moderation history and appeal info')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check (mods only)').setRequired(false)
    ),

  category: 'utility',

  cooldown: 10,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId!;

    if (targetUser && targetUser.id !== interaction.user.id) {
      const member = await interaction.guild!.members.fetch(interaction.user.id);
      if (!member.permissions.has('ModerateMembers')) {
        await interaction.reply({
          content: 'You can only check your own history.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    const checkUser = targetUser || interaction.user;

    const logs = await ModLog.find({ guildId, odId: checkUser.id }, { sort: { createdAt: -1 }, limit: 10 });

    const settings = await GuildSettings.findOne({ guildId });
    const appealInfo = resolveAppealInfo(settings);

    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation History`)
      .setDescription(
        checkUser.id === interaction.user.id
          ? 'Your moderation record on this server'
          : `Moderation record for ${checkUser.tag}`
      )
      .setColor(logs.length > 0 ? '#FFA500' : '#57F287')
      .setThumbnail(checkUser.displayAvatarURL())
      .setTimestamp();

    if (logs.length === 0) {
      embed.addFields({
        name: '✅ Clean Record',
        value: 'No moderation actions found. Keep it up!',
        inline: false
      });
    } else {
      const actionCounts: Record<string, number> = {};
      for (const log of logs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }

      embed.addFields({
        name: '📊 Summary',
        value: Object.entries(actionCounts)
          .map(([action, count]) => `${getActionEmoji(action)} ${action}: ${count}`)
          .join('\n'),
        inline: false
      });

      const recentActions = logs.slice(0, 5).map((log: any) => {
        const date = `<t:${Math.floor(log.createdAt.getTime() / 1000)}:R>`;
        return `${getActionEmoji(log.action)} **${log.action}** - ${date}\n└ ${log.reason.substring(0, 100)}`;
      });

      embed.addFields({
        name: '📜 Recent Actions',
        value: recentActions.join('\n\n'),
        inline: false
      });
    }

    if (appealInfo.enabled) {
      let appealText = '**How to Appeal:**\n';

      if (appealInfo.formUrl) {
        appealText += `📝 [Submit Appeal Form](${appealInfo.formUrl})\n`;
      }
      if (appealInfo.contactEmail) {
        appealText += `📧 Email: ${appealInfo.contactEmail}\n`;
      }
      if (appealInfo.instructions) {
        appealText += `${appealInfo.instructions}\n`;
      }

      appealText += '\n*Please be patient and respectful when appealing.*';

      embed.addFields({
        name: '🔄 Appeals',
        value: appealText,
        inline: false
      });
    } else {
      embed.addFields({
        name: '🔄 Appeals',
        value: 'Contact a server moderator if you believe a punishment was unfair.',
        inline: false
      });
    }

    await interaction.reply({
      embeds: [embed],
      flags: checkUser.id === interaction.user.id ? MessageFlags.Ephemeral : undefined
    });
  }
};

function getActionEmoji(action: string): string {
  const emojis: Record<string, string> = {
    kick: '👢',
    ban: '🔨',
    unban: '✅',
    mute: '🔇',
    unmute: '🔊',
    warn: '⚠️',
    timeout: '⏰',
    clear: '🧹'
  };
  return emojis[action] || '📋';
}

export default command;
