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
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a member (removes the mute role and/or timeout)')
    .addUserOption(option =>
      option.setName('user').setDescription('The member to unmute').setRequired(true)
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
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not in the server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const settings: any = await GuildSettings.findOne({ guildId });
    const muteRoleId: string = resolveModeration(settings).muteRole;
    const role = muteRoleId ? interaction.guild!.roles.cache.get(muteRoleId) : null;

    const actions: string[] = [];
    if (role && target.roles.cache.has(role.id)) {
      await target.roles.remove(role, reason);
      actions.push(`removed role ${role.name}`);
    }
    if (target.isCommunicationDisabled()) {
      await target.timeout(null, reason);
      actions.push('cleared timeout');
    }

    if (actions.length === 0) {
      await interaction.reply({
        embeds: [EmbedHelper.warning('Info', 'This member is not muted.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await ModLog.create({
      guildId,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: 'unmute',
      reason
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(`${target.user.tag} has been unmuted`, `Actions: ${actions.join(', ')}.`)
      ]
    });
  }
};

export default command;
