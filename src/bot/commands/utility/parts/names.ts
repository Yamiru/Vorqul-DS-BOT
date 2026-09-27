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
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { NameHistory } from '../../../../utils/models.js';
import type { Command } from '../../../types.js';

const TYPE_LABEL: Record<string, string> = {
  username: 'Username',
  globalName: 'Display name',
  nickname: 'Nickname'
};

function formatWhen(value: unknown): string {
  if (!value) return '';
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return '';
  return ` (<t:${Math.floor(date.getTime() / 1000)}:R>)`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('names')
    .setDescription('Show the recorded name, display name and nickname history for a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to look up (defaults to you)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser('user') || interaction.user;

    const rows = await NameHistory.forMember(guildId, target.id, 30);

    if (!rows || rows.length === 0) {
      await interaction.reply({
        embeds: [EmbedHelper.info(
          `Name history - ${target.tag}`,
          'No name changes have been recorded for this user yet. History is collected from the moment the bot sees a change.'
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const grouped: Record<string, string[]> = { username: [], globalName: [], nickname: [] };
    for (const row of rows as Array<{ type: string; value: string | null; changed_at?: string }>) {
      const bucket = grouped[row.type];
      if (!bucket) continue;
      const shown = row.value ? `\`${row.value}\`` : '*(cleared)*';
      bucket.push(`${shown}${formatWhen(row.changed_at)}`);
    }

    const embed = EmbedHelper.info(
      `Name history - ${target.tag}`,
      `Recent recorded changes for <@${target.id}>.`
    ).setThumbnail(target.displayAvatarURL({ size: 256 }));

    for (const type of ['username', 'globalName', 'nickname'] as const) {
      if (grouped[type].length > 0) {
        embed.addFields({
          name: TYPE_LABEL[type],
          value: grouped[type].slice(0, 10).join('\n').substring(0, 1024)
        });
      }
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};

export default command;
