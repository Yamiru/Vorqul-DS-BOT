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
import { scheduleTempAction, cancelTempAction } from '../../modules/tempActionScheduler.js';
import type { GuildMember } from 'discord.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('voicemute')
    .setDescription('Stlmenie a ohlušenie v hlasových kanáloch')
    .addSubcommand(sub =>
      sub.setName('mute').setDescription('Stlm člena v hlasovom kanáli')
        .addUserOption(opt => opt.setName('user').setDescription('Koho stlmiť').setRequired(true))
        .addStringOption(opt => opt.setName('trvanie').setDescription('Napríklad 15m, 1h - bez neho natrvalo'))
        .addStringOption(opt => opt.setName('dovod').setDescription('Dôvod')))
    .addSubcommand(sub =>
      sub.setName('unmute').setDescription('Zruš stlmenie')
        .addUserOption(opt => opt.setName('user').setDescription('Komu zrušiť').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('deafen').setDescription('Ohluš člena')
        .addUserOption(opt => opt.setName('user').setDescription('Koho ohlušiť').setRequired(true))
        .addStringOption(opt => opt.setName('dovod').setDescription('Dôvod')))
    .addSubcommand(sub =>
      sub.setName('undeafen').setDescription('Zruš ohlušenie')
        .addUserOption(opt => opt.setName('user').setDescription('Komu zrušiť').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.MuteMembers],
  botPermissions: [PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('dovod') || 'Neuvedený';

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Nenájdený', 'Tento používateľ nie je na serveri.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'mute' || sub === 'deafen') {
      const moderator = interaction.member as GuildMember;
      if (
        interaction.guild!.ownerId !== moderator.id &&
        member.roles.highest.position >= moderator.roles.highest.position
      ) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Chyba', 'Nemôžeš ovplyvniť člena s rovnakou alebo vyššou rolou, ako máš ty.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    if (!member.voice.channel && (sub === 'mute' || sub === 'deafen')) {
      await interaction.reply({
        embeds: [EmbedHelper.warning('Nie je v hlasovom kanáli',
          'Stlmenie sa uplatní až keď sa pripojí - Discord to inak neumožňuje.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      if (sub === 'unmute') {
        await member.voice.setMute(false, `Zrušené ${interaction.user.tag}`);
        await cancelTempAction(guildId, target.id, 'voicemute');
        await interaction.reply({
          embeds: [EmbedHelper.success('Zrušené', `**${target.tag}** už nie je stlmený.`)]
        });
        return;
      }

      if (sub === 'undeafen') {
        await member.voice.setDeaf(false, `Zrušené ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [EmbedHelper.success('Zrušené', `**${target.tag}** už nie je ohlušený.`)]
        });
        return;
      }

      if (sub === 'deafen') {
        await member.voice.setDeaf(true, `${reason} - ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [EmbedHelper.success('Ohlušený', `**${target.tag}** je ohlušený.\n**Dôvod:** ${reason}`)]
        });
        return;
      }

      const durationRaw = interaction.options.getString('trvanie');
      await member.voice.setMute(true, `${reason} - ${interaction.user.tag}`);

      if (!durationRaw) {
        await cancelTempAction(guildId, target.id, 'voicemute');
        await interaction.reply({
          embeds: [EmbedHelper.success('Stlmený',
            `**${target.tag}** je stlmený natrvalo.\n**Dôvod:** ${reason}`)]
        });
        return;
      }

      const durationMs = parseTime(durationRaw);
      if (!durationMs || durationMs < 60_000) {
        await interaction.reply({
          embeds: [EmbedHelper.warning('Stlmený natrvalo',
            'Trvanie som nerozpoznal (použi `15m`, `1h`), takže stlmenie platí, kým ho nezrušíš.')]
        });
        return;
      }

      const expiresAt = Date.now() + durationMs;
      await scheduleTempAction({
        type: 'voicemute',
        guildId,
        userId: target.id,
        expiresAt,
        reason,
        moderatorId: interaction.user.id
      });

      await interaction.reply({
        embeds: [EmbedHelper.success('Stlmený',
          `**${target.tag}** je stlmený na **${formatDuration(durationMs)}**.\n` +
          `**Dôvod:** ${reason}\nZrušim to <t:${Math.floor(expiresAt / 1000)}:R>.`)]
      });
    } catch {
      await interaction.reply({
        embeds: [EmbedHelper.error('Zlyhalo', 'Akciu sa nepodarilo vykonať - skontroluj moje oprávnenia.')],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

export default command;
