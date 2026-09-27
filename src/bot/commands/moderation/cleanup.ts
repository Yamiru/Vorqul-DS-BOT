/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Server cleanup utilities')
    .addSubcommand(sub =>
      sub.setName('orphanedroles').setDescription('Find roles with no members')
    )
    .addSubcommand(sub =>
      sub
        .setName('zombiechannels')
        .setDescription('Find inactive channels')
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Days of inactivity (default: 30)').setMinValue(7).setMaxValue(365).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('permissionrot').setDescription('Find unusual permission combinations')
    )
    .addSubcommand(sub =>
      sub.setName('audit').setDescription('Full server audit report')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'moderation',

  cooldown: 15,
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    switch (subcommand) {
      case 'orphanedroles': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const orphanedRoles = guild.roles.cache.filter(role =>
          role.members.size === 0 &&
          !role.managed &&
          role.id !== guild.id &&
          !role.tags?.botId &&
          !role.tags?.integrationId
        );

        if (orphanedRoles.size === 0) {
          await interaction.editReply({
            embeds: [EmbedHelper.success('No Orphaned Roles', 'All roles have at least one member.')]
          });
          return;
        }

        const roleList = orphanedRoles.map(r =>
          `• ${r.name} (Position: ${r.position})`
        ).slice(0, 20).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('👻 Orphaned Roles Found')
          .setDescription(
            `Found **${orphanedRoles.size}** roles with no members:\n\n${roleList}` +
            (orphanedRoles.size > 20 ? `\n...and ${orphanedRoles.size - 20} more` : '')
          )
          .setColor('#FFA500')
          .setFooter({ text: 'Consider deleting unused roles to keep the server clean' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('cleanup_delete_roles')
            .setLabel(`Delete All (${orphanedRoles.size})`)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(orphanedRoles.size > 10),
          new ButtonBuilder()
            .setCustomId('cleanup_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        break;
      }

      case 'zombiechannels': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const days = interaction.options.getInteger('days') || 30;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const zombieChannels: { id: string; name: string; lastMessage: number | null }[] = [];

        for (const [, channel] of guild.channels.cache) {
          if (!channel.isTextBased()) continue;
          if (channel.isThread()) continue;

          try {
            const messages = await (channel as any).messages.fetch({ limit: 1 });
            const lastMessage = messages.first();
            const lastMessageTime = lastMessage?.createdTimestamp || null;

            if (!lastMessageTime || lastMessageTime < cutoff) {
              zombieChannels.push({
                id: channel.id,
                name: channel.name,
                lastMessage: lastMessageTime
              });
            }
          } catch (error) {
              logger.debug('cleanup: suppressed error', error);
            }
        }

        if (zombieChannels.length === 0) {
          await interaction.editReply({
            embeds: [EmbedHelper.success('No Zombie Channels', `All channels have been active in the last ${days} days.`)]
          });
          return;
        }

        const channelList = zombieChannels.slice(0, 15).map(c => {
          const lastActive = c.lastMessage
            ? `<t:${Math.floor(c.lastMessage / 1000)}:R>`
            : 'Never';
          return `• <#${c.id}> (Last: ${lastActive})`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('💀 Zombie Channels Found')
          .setDescription(
            `Found **${zombieChannels.length}** channels with no activity in ${days}+ days:\n\n${channelList}` +
            (zombieChannels.length > 15 ? `\n...and ${zombieChannels.length - 15} more` : '')
          )
          .setColor('#FFA500')
          .setFooter({ text: 'Consider archiving or deleting inactive channels' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'permissionrot': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const issues: string[] = [];

        for (const [, role] of guild.roles.cache) {
          if (role.id === guild.id) continue;

          const perms = role.permissions;

          if (perms.has('Administrator') && role.members.size > 5) {
            issues.push(`⚠️ **${role.name}** has Admin with ${role.members.size} members`);
          }

          if (perms.has('ManageRoles') && !perms.has('Administrator')) {
            const higherRoles = guild.roles.cache.filter(r => r.position > role.position);
            if (higherRoles.some(r => r.permissions.has('Administrator'))) {
              issues.push(`⚠️ **${role.name}** can manage roles below admin roles`);
            }
          }

          const dangerousPerms = ['BanMembers', 'KickMembers', 'ManageGuild', 'ManageChannels'];
          const hasDangerous = dangerousPerms.some(p => perms.has(p as any));
          if (hasDangerous && role.position < 5) {
            issues.push(`⚠️ **${role.name}** has mod perms but low position (${role.position})`);
          }

          if (role.mentionable && role.members.size > 50) {
            issues.push(`📢 **${role.name}** is mentionable with ${role.members.size} members`);
          }
        }

        const everyonePerms = guild.roles.everyone.permissions;
        const dangerousEveryone = ['SendMessages', 'AddReactions', 'CreatePublicThreads', 'CreatePrivateThreads'];
        const everyoneIssues = dangerousEveryone.filter(p => everyonePerms.has(p as any));
        if (everyoneIssues.length > 0) {
          issues.push(`📢 @everyone has: ${everyoneIssues.map(p => p.replace(/([A-Z])/g, ' $1').trim()).join(', ')}`);
        }

        if (issues.length === 0) {
          await interaction.editReply({
            embeds: [EmbedHelper.success('No Issues Found', 'Permission setup looks clean!')]
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🔐 Permission Audit')
          .setDescription(
            `Found **${issues.length}** potential issues:\n\n${issues.slice(0, 15).join('\n')}` +
            (issues.length > 15 ? `\n...and ${issues.length - 15} more` : '')
          )
          .setColor('#FFA500')
          .setFooter({ text: 'Review these permissions for security' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'audit': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const totalRoles = guild.roles.cache.size;
        const orphanedRoles = guild.roles.cache.filter(r =>
          r.members.size === 0 && !r.managed && r.id !== guild.id
        ).size;

        const totalChannels = guild.channels.cache.size;
        const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread()).size;
        const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const threads = guild.channels.cache.filter(c => c.isThread()).size;

        const botsCount = guild.members.cache.filter(m => m.user.bot).size;
        const adminCount = guild.members.cache.filter(m => m.permissions.has('Administrator')).size;
        const modCount = guild.members.cache.filter(m =>
          m.permissions.has('ModerateMembers') || m.permissions.has('KickMembers') || m.permissions.has('BanMembers')
        ).size;

        const embed = new EmbedBuilder()
          .setTitle('📊 Server Audit Report')
          .setColor(config.bot.embedColor as `#${string}`)
          .setThumbnail(guild.iconURL() || '')
          .addFields(
            { name: '👥 Members', value: `Total: ${guild.memberCount}\nBots: ${botsCount}\nAdmins: ${adminCount}\nMods: ${modCount}`, inline: true },
            { name: '📁 Channels', value: `Total: ${totalChannels}\nText: ${textChannels}\nVoice: ${voiceChannels}\nCategories: ${categories}\nThreads: ${threads}`, inline: true },
            { name: '🎭 Roles', value: `Total: ${totalRoles}\nOrphaned: ${orphanedRoles}`, inline: true },
            { name: '🔒 Security', value: `2FA Required: ${guild.mfaLevel ? 'Yes' : 'No'}\nVerification: ${getVerificationLevel(guild.verificationLevel)}\nNSFW Level: ${getNSFWLevel(guild.nsfwLevel)}`, inline: true },
            { name: '📈 Boost', value: `Level: ${guild.premiumTier}\nBoosters: ${guild.premiumSubscriptionCount || 0}`, inline: true },
            { name: '⚙️ Features', value: guild.features.slice(0, 5).map(f => `• ${f.replace(/_/g, ' ')}`).join('\n') || 'None', inline: true }
          )
          .setFooter({ text: `Server ID: ${guild.id}` })
          .setTimestamp();

        const recommendations: string[] = [];
        if (orphanedRoles > 5) recommendations.push('• Clean up orphaned roles');
        if (adminCount > 3) recommendations.push('• Review admin count (currently ' + adminCount + ')');
        if (!guild.mfaLevel) recommendations.push('• Enable 2FA requirement for mods');
        if (guild.verificationLevel < 2) recommendations.push('• Increase verification level');

        if (recommendations.length > 0) {
          embed.addFields({
            name: '💡 Recommendations',
            value: recommendations.join('\n'),
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  }
};

function getVerificationLevel(level: number): string {
  const levels = ['None', 'Low', 'Medium', 'High', 'Very High'];
  return levels[level] || 'Unknown';
}

function getNSFWLevel(level: number): string {
  const levels = ['Default', 'Explicit', 'Safe', 'Age Restricted'];
  return levels[level] || 'Unknown';
}

export default command;
