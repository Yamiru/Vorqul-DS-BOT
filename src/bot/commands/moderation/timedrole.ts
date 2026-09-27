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
import {
  scheduleTempAction,
  cancelTempAction,
  listTempActions
} from '../../modules/tempActionScheduler.js';
import type { GuildMember } from 'discord.js';
import type { Command } from '../../types.js';
import { suppress } from '../../../utils/suppress.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timedrole')
    .setDescription('Rola, ktorá po čase sama zmizne')
    .addSubcommand(sub =>
      sub.setName('add').setDescription('Prideľ rolu na určitý čas')
        .addUserOption(opt => opt.setName('user').setDescription('Komu').setRequired(true))
        .addRoleOption(opt => opt.setName('rola').setDescription('Ktorú rolu').setRequired(true))
        .addStringOption(opt => opt.setName('trvanie')
          .setDescription('Napríklad 1h, 3d, 2w').setRequired(true))
        .addStringOption(opt => opt.setName('dovod').setDescription('Dôvod')))
    .addSubcommand(sub =>
      sub.setName('remove').setDescription('Odober rolu a zruš naplánované vypršanie')
        .addUserOption(opt => opt.setName('user').setDescription('Komu').setRequired(true))
        .addRoleOption(opt => opt.setName('rola').setDescription('Ktorú rolu').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('Zoznam prebiehajúcich dočasných opatrení'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const actions = await listTempActions(guildId);

      if (actions.length === 0) {
        await interaction.reply({
          embeds: [EmbedHelper.info('Dočasné opatrenia', 'Momentálne nič nebeží.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const labels: Record<string, string> = {
        ban: '🔨 Ban',
        role: '🎭 Rola',
        voicemute: '🔇 Voice mute'
      };

      const lines = actions
        .sort((a, b) => a.expiresAt - b.expiresAt)
        .slice(0, 20)
        .map(a => {
          const what = a.type === 'role' && a.roleId ? `${labels.role} <@&${a.roleId}>` : labels[a.type] || a.type;
          return `${what} - <@${a.userId}> · vyprší <t:${Math.floor(a.expiresAt / 1000)}:R>`;
        });

      await interaction.reply({
        embeds: [EmbedHelper.info('Dočasné opatrenia',
          lines.join('\n') + (actions.length > 20 ? `\n\n…a ďalších ${actions.length - 20}` : ''))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('rola', true);

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Nenájdený', 'Tento používateľ nie je na serveri.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const me = interaction.guild!.members.me;
    if (me && role.position >= me.roles.highest.position) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Nedá sa',
          `Rola <@&${role.id}> je vyššie než moja najvyššia rola - nemôžem s ňou pracovať.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const moderator = interaction.member as GuildMember;
    if (interaction.guild!.ownerId !== moderator.id && role.position >= moderator.roles.highest.position) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Nedá sa',
          `Rola <@&${role.id}> je rovnaká alebo vyššia než tvoja najvyššia rola - nemôžeš s ňou pracovať.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'remove') {
      await member.roles.remove(role.id, `Ručne odobrané ${interaction.user.tag}`).catch(suppress('timedrole'));
      const had = await cancelTempAction(guildId, target.id, 'role', role.id);

      await interaction.reply({
        embeds: [EmbedHelper.success('Odobraté',
          `<@&${role.id}> odobraná používateľovi **${target.tag}**.` +
          (had ? '\nNaplánované vypršanie som zrušil.' : ''))]
      });
      return;
    }

    const durationRaw = interaction.options.getString('trvanie', true);
    const reason = interaction.options.getString('dovod') || 'Neuvedený';
    const durationMs = parseTime(durationRaw);

    if (!durationMs || durationMs < 60_000) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Neplatné trvanie',
          'Použi zápis ako `1h`, `3d`, `2w`. Minimum je 1 minúta.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await member.roles.add(role.id, `[Dočasná rola ${formatDuration(durationMs)}] ${reason} - ${interaction.user.tag}`);
    } catch {
      await interaction.reply({
        embeds: [EmbedHelper.error('Zlyhalo', 'Rolu sa nepodarilo prideliť.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const expiresAt = Date.now() + durationMs;
    await scheduleTempAction({
      type: 'role',
      guildId,
      userId: target.id,
      roleId: role.id,
      expiresAt,
      reason,
      moderatorId: interaction.user.id
    });

    await interaction.reply({
      embeds: [EmbedHelper.success('Dočasná rola',
        `**${target.tag}** dostal <@&${role.id}> na **${formatDuration(durationMs)}**.\n` +
        `**Dôvod:** ${reason}\nOdoberiem ju <t:${Math.floor(expiresAt / 1000)}:R>.`)]
    });
  }
};

export default command;
