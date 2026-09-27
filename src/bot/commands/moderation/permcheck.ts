/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, GuildMember, Role, TextChannel, MessageFlags } from 'discord.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('permcheck')
    .setDescription('Permission checking and preview')
    .addSubcommand(sub =>
      sub
        .setName('user')
        .setDescription('Check user permissions')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to check').setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel context').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Check role permissions')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to check').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('compare')
        .setDescription('Compare two users/roles')
        .addUserOption(opt =>
          opt.setName('user1').setDescription('First user').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user2').setDescription('Second user').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('simulate')
        .setDescription('Simulate what would happen with an action')
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Action to simulate')
            .setRequired(true)
            .addChoices(
              { name: 'Kick User', value: 'kick' },
              { name: 'Ban User', value: 'ban' },
              { name: 'Timeout User', value: 'timeout' },
              { name: 'Delete Messages', value: 'delete' },
              { name: 'Manage Roles', value: 'roles' }
            )
        )
        .addUserOption(opt =>
          opt.setName('target').setDescription('Target user').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'user': {
        const user = interaction.options.getUser('user', true);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const member = await interaction.guild!.members.fetch(user.id).catch(() => null);

        if (!member) {
          await interaction.reply({ content: 'User not found in server.', flags: MessageFlags.Ephemeral });
          return;
        }

        const perms = member.permissions.toArray();
        const channelPerms = channel ? (channel as TextChannel).permissionsFor(member)?.toArray() || [] : [];

        const embed = new EmbedBuilder()
          .setTitle(`🔐 ${user.username}'s Permissions`)
          .setThumbnail(user.displayAvatarURL())
          .setColor(config.bot.embedColor as `#${string}`)
          .addFields(
            {
              name: '🏠 Server Permissions',
              value: perms.length > 0 ? formatPerms(perms).substring(0, 1024) : 'None',
              inline: false
            },
            {
              name: `📺 Channel Permissions (${(channel as any).name})`,
              value: channelPerms.length > 0 ? formatPerms(channelPerms).substring(0, 1024) : 'None',
              inline: false
            },
            {
              name: '📋 Roles',
              value: member.roles.cache.map(r => r.name).slice(0, 20).join(', ') || 'None',
              inline: false
            }
          )
          .setFooter({ text: `Highest Role: ${member.roles.highest.name}` })
          .setTimestamp();

        const keyPerms = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'BanMembers', 'KickMembers', 'ModerateMembers'];
        const hasKeyPerms = keyPerms.filter(p => perms.includes(p as any));

        if (hasKeyPerms.length > 0) {
          embed.addFields({
            name: '⚠️ Key Permissions',
            value: hasKeyPerms.map(p => `✅ ${formatPermName(p)}`).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'role': {
        const role = interaction.options.getRole('role', true) as Role;
        const perms = role.permissions.toArray();

        const embed = new EmbedBuilder()
          .setTitle(`🎭 ${role.name} Permissions`)
          .setColor(role.color || config.bot.embedColor as `#${string}`)
          .addFields(
            { name: 'Position', value: `${role.position}`, inline: true },
            { name: 'Members', value: `${role.members.size}`, inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            {
              name: '🔐 Permissions',
              value: perms.length > 0 ? formatPerms(perms).substring(0, 1024) : 'None',
              inline: false
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'compare': {
        const user1 = interaction.options.getUser('user1', true);
        const user2 = interaction.options.getUser('user2', true);

        const member1 = await interaction.guild!.members.fetch(user1.id).catch(() => null);
        const member2 = await interaction.guild!.members.fetch(user2.id).catch(() => null);

        if (!member1 || !member2) {
          await interaction.reply({ content: 'One or both users not found.', flags: MessageFlags.Ephemeral });
          return;
        }

        const perms1 = member1.permissions.toArray();
        const perms2 = member2.permissions.toArray();

        const onlyUser1 = perms1.filter(p => !perms2.includes(p));
        const onlyUser2 = perms2.filter(p => !perms1.includes(p));
        const shared = perms1.filter(p => perms2.includes(p));

        const embed = new EmbedBuilder()
          .setTitle('⚖️ Permission Comparison')
          .setColor(config.bot.embedColor as `#${string}`)
          .addFields(
            {
              name: `✅ Only ${user1.username}`,
              value: onlyUser1.length > 0 ? formatPerms(onlyUser1).substring(0, 1024) : 'None',
              inline: true
            },
            {
              name: `✅ Only ${user2.username}`,
              value: onlyUser2.length > 0 ? formatPerms(onlyUser2).substring(0, 1024) : 'None',
              inline: true
            },
            {
              name: '🤝 Shared Permissions',
              value: shared.length > 0 ? formatPerms(shared).substring(0, 1024) : 'None',
              inline: false
            },
            {
              name: '📊 Role Comparison',
              value: `**${user1.username}:** ${member1.roles.highest.name} (Position ${member1.roles.highest.position})\n` +
                     `**${user2.username}:** ${member2.roles.highest.name} (Position ${member2.roles.highest.position})`,
              inline: false
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'simulate': {
        const action = interaction.options.getString('action', true);
        const target = interaction.options.getUser('target', true);
        const targetMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
        const botMember = interaction.guild!.members.me!;
        const executorMember = interaction.member as GuildMember;

        if (!targetMember) {
          await interaction.reply({ content: 'Target not found.', flags: MessageFlags.Ephemeral });
          return;
        }

        const checks: { check: string; passed: boolean; reason: string }[] = [];

        switch (action) {
          case 'kick':
          case 'ban':
          case 'timeout': {
            const botPerm = action === 'kick' ? 'KickMembers' : action === 'ban' ? 'BanMembers' : 'ModerateMembers';
            checks.push({
              check: `Bot has ${formatPermName(botPerm)}`,
              passed: botMember.permissions.has(botPerm as any),
              reason: botMember.permissions.has(botPerm as any) ? 'Bot can perform this action' : 'Bot lacks permission'
            });

            checks.push({
              check: `You have ${formatPermName(botPerm)}`,
              passed: executorMember.permissions.has(botPerm as any),
              reason: executorMember.permissions.has(botPerm as any) ? 'You can perform this action' : 'You lack permission'
            });

            checks.push({
              check: 'Bot role higher than target',
              passed: botMember.roles.highest.position > targetMember.roles.highest.position,
              reason: botMember.roles.highest.position > targetMember.roles.highest.position ?
                'Bot can manage target' : 'Target has equal or higher role than bot'
            });

            checks.push({
              check: 'Your role higher than target',
              passed: executorMember.roles.highest.position > targetMember.roles.highest.position,
              reason: executorMember.roles.highest.position > targetMember.roles.highest.position ?
                'You can manage target' : 'Target has equal or higher role than you'
            });

            checks.push({
              check: 'Target is not server owner',
              passed: target.id !== interaction.guild!.ownerId,
              reason: target.id !== interaction.guild!.ownerId ? 'Target can be moderated' : 'Cannot moderate server owner'
            });
            break;
          }

          case 'delete':
            checks.push({
              check: 'Bot has Manage Messages',
              passed: botMember.permissions.has('ManageMessages'),
              reason: botMember.permissions.has('ManageMessages') ? 'Bot can delete messages' : 'Bot lacks permission'
            });
            break;

          case 'roles':
            checks.push({
              check: 'Bot has Manage Roles',
              passed: botMember.permissions.has('ManageRoles'),
              reason: botMember.permissions.has('ManageRoles') ? 'Bot can manage roles' : 'Bot lacks permission'
            });
            break;
        }

        const allPassed = checks.every(c => c.passed);

        const embed = new EmbedBuilder()
          .setTitle(`🔮 Simulation: ${action.charAt(0).toUpperCase() + action.slice(1)} ${target.username}`)
          .setColor(allPassed ? '#57F287' : '#ED4245')
          .setDescription(
            checks.map(c =>
              `${c.passed ? '✅' : '❌'} **${c.check}**\n   └ ${c.reason}`
            ).join('\n\n')
          )
          .addFields({
            name: '📊 Result',
            value: allPassed ?
              '✅ **Action would succeed** - All permission checks passed.' :
              '❌ **Action would fail** - One or more permission checks failed.',
            inline: false
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }
    }
  }
};

function formatPerms(perms: string[]): string {
  return perms.map(p => `• ${formatPermName(p)}`).join('\n');
}

function formatPermName(perm: string): string {
  return perm.replace(/([A-Z])/g, ' $1').trim();
}

export default command;
