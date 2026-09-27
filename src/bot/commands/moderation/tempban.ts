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
import { parseTime, formatDuration } from '../../../utils/helpers.js';
import { scheduleTempAction } from '../../modules/tempActionScheduler.js';
import type { Command } from '../../types.js';
import { suppress } from '../../../utils/suppress.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Zabanuj člena na určitý čas - bot ho potom sám odbanuje')
    .addUserOption(opt => opt.setName('user').setDescription('Koho banovať').setRequired(true))
    .addStringOption(opt => opt.setName('trvanie')
      .setDescription('Napríklad 30m, 2h, 7d').setRequired(true))
    .addStringOption(opt => opt.setName('dovod').setDescription('Dôvod banu'))
    .addIntegerOption(opt => opt.setName('zmazat_spravy')
      .setDescription('Zmazať správy za posledných N hodín (0-168)').setMinValue(0).setMaxValue(168))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getUser('user', true);
    const durationRaw = interaction.options.getString('trvanie', true);
    const reason = interaction.options.getString('dovod') || 'Neuvedený';
    const deleteHours = interaction.options.getInteger('zmazat_spravy') || 0;

    const durationMs = parseTime(durationRaw);
    if (!durationMs || durationMs < 60_000) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Neplatné trvanie',
          'Použi zápis ako `30m`, `2h`, `7d`. Najkratší možný ban je 1 minúta.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Chyba', 'Sám seba zabanovať nemôžeš.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);

    if (member) {
      if (!member.bannable) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Nedá sa', 'Tohto člena nemôžem zabanovať - má vyššiu rolu než ja.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const executor = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
      if (executor && member.roles.highest.position >= executor.roles.highest.position
          && interaction.guild!.ownerId !== interaction.user.id) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Nedá sa', 'Nemôžeš banovať niekoho s rovnakou alebo vyššou rolou.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    const expiresAt = Date.now() + durationMs;
    const human = formatDuration(durationMs);

    await target.send(
      `Bol si dočasne zabanovaný na serveri **${interaction.guild!.name}**.\n` +
      `**Trvanie:** ${human}\n**Dôvod:** ${reason}\n` +
      `Ban automaticky vyprší <t:${Math.floor(expiresAt / 1000)}:R>.`
    ).catch(suppress('tempban'));

    try {
      await interaction.guild!.members.ban(target.id, {
        reason: `[TempBan ${human}] ${reason} - ${interaction.user.tag}`,
        deleteMessageSeconds: deleteHours * 3600
      });
    } catch {
      await interaction.reply({
        embeds: [EmbedHelper.error('Zlyhalo', 'Ban sa nepodarilo vykonať.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await scheduleTempAction({
      type: 'ban',
      guildId,
      userId: target.id,
      expiresAt,
      reason,
      moderatorId: interaction.user.id
    });

    await interaction.reply({
      embeds: [EmbedHelper.success('Dočasný ban',
        `**${target.tag}** je zabanovaný na **${human}**.\n` +
        `**Dôvod:** ${reason}\n` +
        `Odbanujem ho <t:${Math.floor(expiresAt / 1000)}:R>.`)]
    });
  }
};

export default command;
