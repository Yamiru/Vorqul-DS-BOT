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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { FeatureToggle } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('persist')
    .setDescription('Restore a member\'s roles and nickname when they rejoin the server')
    .addSubcommand(sub =>
      sub.setName('enable').setDescription('Enable role persistence for this server'))
    .addSubcommand(sub =>
      sub.setName('disable').setDescription('Disable role persistence for this server'))
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Show whether role persistence is enabled'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const enabled = await FeatureToggle.isEnabled(guildId, 'rolePersist');
      await interaction.reply({
        embeds: [EmbedHelper.info(
          'Role Persistence',
          enabled
            ? 'Role persistence is **enabled**. Members keep their roles and nickname when they rejoin.'
            : 'Role persistence is **disabled**.'
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const enable = sub === 'enable';
    await FeatureToggle.set(guildId, 'rolePersist', enable);

    await interaction.reply({
      embeds: [EmbedHelper.success(
        'Role Persistence Updated',
        enable
          ? 'Members will now keep their roles and nickname when they rejoin the server.'
          : 'Role persistence has been turned off.'
      )],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
