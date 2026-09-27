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
  GuildMember
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { Jail } from '../../../utils/models.js';
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const JAIL_ROLE = 'Jailed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Release a member from jail and restore their previous roles')
    .addUserOption(o => o.setName('user').setDescription('Member to release').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    const target = interaction.options.getUser('user', true);

    const record: any = await Jail.findOne({ guildId: interaction.guildId!, userId: target.id });
    if (!record) {
      await interaction.editReply({ embeds: [EmbedHelper.error('Error', 'This member is not jailed.')] });
      return;
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null) as GuildMember | null;
    if (member) {
      const jailRole = interaction.guild!.roles.cache.find(r => r.name === JAIL_ROLE);
      const me = interaction.guild!.members.me!;
      const restore: string[] = (record.roles || []).filter((rid: string) => {
        const r = interaction.guild!.roles.cache.get(rid);
        return r && !r.managed && r.position < me.roles.highest.position;
      });
      try {
        await member.roles.set(restore, 'Unjailed');
      } catch {
        if (jailRole) {
          try {
            await member.roles.remove(jailRole.id);
          } catch (error) {
            logger.debug('unjail: suppressed error', error);
          }
        }
      }
    }

    await Jail.remove({ guildId: interaction.guildId!, userId: target.id });

    await interaction.editReply({
      embeds: [EmbedHelper.success(`🔓 ${target.tag} released`, 'Their previous roles have been restored.')]
    });
  }
};

export default command;
