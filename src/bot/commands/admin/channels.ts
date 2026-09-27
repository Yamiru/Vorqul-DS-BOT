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
  AutocompleteInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import {
  FEATURES,
  getFeatureDefinition,
  normalizeScope,
  describeScope,
  type ChannelScope,
  type ScopeMode
} from '../../../utils/channelScope.js';
import type { Command } from '../../types.js';
import { i18n } from '../../../utils/i18n.js';

const SELECTABLE_CHANNELS = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildStageVoice,
  ChannelType.GuildCategory
] as const;

async function loadScopes(guildId: string): Promise<Record<string, ChannelScope>> {
  const settings = await GuildSettings.findOne({ guildId });
  const raw = (settings as any)?.channelScopes || {};
  const out: Record<string, ChannelScope> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = normalizeScope(value);
  return out;
}

async function saveScopes(guildId: string, scopes: Record<string, ChannelScope>): Promise<void> {
  await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: { channel_scopes: scopes } },
    { upsert: true }
  );
}

function featureLabel(feature: { label: string; emoji?: string }, guildId?: string): string {
  const label = i18n.t(feature.label, guildId);
  return feature.emoji ? `${feature.emoji} ${label}` : label;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Set which channels each bot feature runs in')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the channel scope for a feature')
        .addStringOption(opt =>
          opt
            .setName('funkcia')
            .setDescription('Which bot feature')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(opt =>
          opt
            .setName('rezim')
            .setDescription('Where the feature should run')
            .setRequired(true)
            .addChoices(
              { name: 'Everywhere', value: 'all' },
              { name: 'Only in the selected channels', value: 'only' },
              { name: 'Everywhere except the selected channels', value: 'except' }
            )))
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a channel or category to the feature list')
        .addStringOption(opt =>
          opt
            .setName('funkcia')
            .setDescription('Which bot feature')
            .setRequired(true)
            .setAutocomplete(true))
        .addChannelOption(opt =>
          opt
            .setName('kanal')
            .setDescription('A channel or a whole category')
            .addChannelTypes(...SELECTABLE_CHANNELS)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a channel or category from the feature list')
        .addStringOption(opt =>
          opt
            .setName('funkcia')
            .setDescription('Which bot feature')
            .setRequired(true)
            .setAutocomplete(true))
        .addChannelOption(opt =>
          opt
            .setName('kanal')
            .setDescription('A channel or a whole category')
            .addChannelTypes(...SELECTABLE_CHANNELS)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Reset the feature back to everywhere')
        .addStringOption(opt =>
          opt
            .setName('funkcia')
            .setDescription('Which bot feature')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('Show the current setting for every feature'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = FEATURES.filter(
      f =>
        f.key.toLowerCase().includes(focused) ||
        featureLabel(f, interaction.guildId ?? undefined).toLowerCase().includes(focused)
    ).slice(0, 25);

    await interaction.respond(
      matches.map(f => ({
        name: `${i18n.t(f.group, interaction.guildId ?? undefined)} \u00b7 ${featureLabel(f, interaction.guildId ?? undefined)}`.slice(0, 100),
        value: f.key
      }))
    );
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const scopes = await loadScopes(guildId);

    if (sub === 'list') {
      const lines: string[] = [];
      let currentGroup = '';

      for (const feature of FEATURES) {
        const scope = scopes[feature.key];
        if (!scope || scope.mode === 'all') continue;
        if (feature.group !== currentGroup) {
          currentGroup = feature.group;
          lines.push(`\n**${i18n.t(currentGroup, guildId)}**`);
        }
        lines.push(`\u2022 ${featureLabel(feature, guildId)} \u2014 ${describeScope(scope, guildId)}`);
      }

      await interaction.reply({
        embeds: [EmbedHelper.info(
          i18n.t('channels.title', guildId),
          lines.length > 0
            ? lines.join('\n').trim()
            : i18n.t('channels.nothingRestricted', guildId)
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const featureKey = interaction.options.getString('funkcia', true);
    const definition = getFeatureDefinition(featureKey);

    if (!definition) {
      await interaction.reply({
        embeds: [EmbedHelper.error(i18n.t('channels.unknownFeature', guildId), i18n.t('channels.unknownFeatureBody', guildId, { key: featureKey }))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const current: ChannelScope = scopes[featureKey] || { mode: 'all', channels: [] };

    if (sub === 'reset') {
      delete scopes[featureKey];
      await saveScopes(guildId, scopes);
      await interaction.reply({
        embeds: [EmbedHelper.success(i18n.t('channels.restored', guildId), i18n.t('channels.restoredBody', guildId, { feature: featureLabel(definition, guildId) }))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'set') {
      const mode = interaction.options.getString('rezim', true) as ScopeMode;

      if (mode === 'all') {
        delete scopes[featureKey];
        await saveScopes(guildId, scopes);
        await interaction.reply({
          embeds: [EmbedHelper.success(i18n.t('channels.saved', guildId), i18n.t('channels.savedEverywhere', guildId, { feature: featureLabel(definition, guildId) }))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      scopes[featureKey] = { mode, channels: current.channels };
      await saveScopes(guildId, scopes);

      const hint = current.channels.length === 0
        ? `\n\n${i18n.t('channels.noChannelYet', guildId)}`
        : `\n\n${i18n.t('channels.current', guildId, { scope: describeScope(scopes[featureKey], guildId) })}`;

      await interaction.reply({
        embeds: [EmbedHelper.success(
          i18n.t('channels.saved', guildId),
          i18n.t('channels.modeSetTo', guildId, { feature: featureLabel(definition, guildId) }) +
          `**${i18n.t(mode === 'only' ? 'channels.modeOnly' : 'channels.modeExcept', guildId)}**.${hint}`
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.options.getChannel('kanal', true);
    const channels = [...current.channels];

    if (sub === 'add') {
      if (channels.includes(channel.id)) {
        await interaction.reply({
          embeds: [EmbedHelper.warning(i18n.t('channels.alreadyListed', guildId), i18n.t('channels.alreadyListedBody', guildId, { channel: channel.id, feature: featureLabel(definition, guildId) }))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      channels.push(channel.id);
    } else {
      const index = channels.indexOf(channel.id);
      if (index === -1) {
        await interaction.reply({
          embeds: [EmbedHelper.warning(i18n.t('channels.notFound', guildId), i18n.t('channels.notFoundBody', guildId, { channel: channel.id, feature: featureLabel(definition, guildId) }))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      channels.splice(index, 1);
    }

    const mode: ScopeMode = current.mode === 'all' && sub === 'add' ? 'only' : current.mode;
    const updated = normalizeScope({ mode, channels });

    if (updated.mode === 'all' && updated.channels.length === 0) {
      delete scopes[featureKey];
    } else {
      scopes[featureKey] = updated;
    }
    await saveScopes(guildId, scopes);

    const isCategory = channel.type === ChannelType.GuildCategory;
    const note = isCategory
      ? `\n\n${i18n.t('channels.categoryNote', guildId)}`
      : '';

    await interaction.reply({
      embeds: [EmbedHelper.success(
        i18n.t(sub === 'add' ? 'channels.added' : 'channels.removed', guildId),
        `**${definition.label}** - ${describeScope(updated)}.${note}`
      )],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
