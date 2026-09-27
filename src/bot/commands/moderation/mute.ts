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
  GuildMember,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { ModLog, GuildSettings } from '../../../utils/models.js';
import { resolveModeration } from '../../../shared/featureConfig.js';
import { parseTime, formatDuration } from '../../../utils/helpers.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member (uses the configured mute role, or a timeout as fallback)')
    .addUserOption(option =>
      option.setName('user').setDescription('The member to mute').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration').setDescription('Optional duration (e.g. 10m, 1h, 1d)').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getMember('user') as GuildMember | null;
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not in the server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (!target.manageable && !target.moderatable) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'I cannot mute this member (higher role).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = interaction.member as GuildMember;
    if (target.roles.highest.position >= member.roles.highest.position && interaction.guild!.ownerId !== member.id) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This member has a higher or equal role.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const settings: any = await GuildSettings.findOne({ guildId });
    const muteRoleId: string = resolveModeration(settings).muteRole;
    let duration: number | null = null;
    if (durationStr) {
      duration = parseTime(durationStr);
      if (!duration) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', 'Invalid duration. Use formats like 10m, 1h, 1d.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    let method: string;
    const role = muteRoleId ? interaction.guild!.roles.cache.get(muteRoleId) : null;

    if (role && target.manageable) {
      await target.roles.add(role, reason);
      method = `Mute role: ${role.name}`;
    } else {
      const ms = Math.min(duration ?? 28 * 24 * 60 * 60 * 1000, 28 * 24 * 60 * 60 * 1000);
      await target.timeout(ms, reason);
      method = 'Timeout (no mute role configured)';
    }

    await ModLog.create({
      guildId,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: 'mute',
      reason,
      duration: duration ?? undefined
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          `${target.user.tag} has been muted`,
          `${duration ? `**Duration:** ${formatDuration(duration)}\n` : ''}**Method:** ${method}\n**Reason:** ${reason}`
        )
      ]
    });
  }
};

export default command;
