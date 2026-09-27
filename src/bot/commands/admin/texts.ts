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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import { i18n } from '../../../utils/i18n.js';
import { COMMON_TEXT_KEYS, invalidateCustomTexts } from '../../../utils/customTexts.js';
import type { Command } from '../../types.js';
import { languageChoices } from '../../../shared/languages.js';

async function loadTexts(guildId: string): Promise<Record<string, string>> {
  const settings = await GuildSettings.findOne({ guildId });
  const raw = (settings as any)?.custom_texts || (settings as any)?.customTexts || {};
  return typeof raw === 'object' ? { ...raw } : {};
}

async function saveTexts(guildId: string, texts: Record<string, string>): Promise<void> {
  await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: { custom_texts: texts } },
    { upsert: true }
  );
  invalidateCustomTexts();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('texts')
    .setDescription('Rewrite the wording of the bot messages')
    .addSubcommand(sub =>
      sub.setName('set').setDescription('Set your own wording')
        .addStringOption(opt => opt.setName('kluc')
          .setDescription('Which text').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('text')
          .setDescription('New wording, variables in {curly} braces').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reset').setDescription('Restore the original wording')
        .addStringOption(opt => opt.setName('kluc')
          .setDescription('Which text').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('show').setDescription('Show the current wording')
        .addStringOption(opt => opt.setName('kluc')
          .setDescription('Which text').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List every overridden text'))
    .addSubcommand(sub =>
      sub.setName('language').setDescription('Jazyk bota na tomto serveri')
        .addStringOption(opt => opt.setName('jazyk').setDescription('Language code').setRequired(true)
          .addChoices(...languageChoices())))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId!;

    const overridden = Object.keys(await loadTexts(guildId).catch(() => ({})));
    const known = COMMON_TEXT_KEYS.map(k => k.key);
    const all = Array.from(new Set([...known, ...overridden]));

    const matches = all
      .filter(key => key.toLowerCase().includes(focused))
      .slice(0, 25);

    await interaction.respond(
      matches.map(key => {
        const hintKey = COMMON_TEXT_KEYS.find(k => k.key === key)?.hint;
        const hint = hintKey ? i18n.t(hintKey, interaction.guildId ?? undefined) : undefined;
        return { name: hint ? `${key} \u2014 ${hint}`.slice(0, 100) : key, value: key };
      })
    );
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'language') {
      const language = interaction.options.getString('jazyk', true);
      const available = i18n.availableLanguages();

      if (!available.includes(language)) {
        await interaction.reply({
          embeds: [EmbedHelper.error(i18n.t('texts.langUnavailable', guildId),
            i18n.t('texts.langUnavailableBody', guildId, { list: available.join(', ') || i18n.t('texts.none', guildId) }))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await GuildSettings.findOneAndUpdate(
        { guildId },
        { $set: { language } },
        { upsert: true }
      );
      i18n.setGuildLanguage(guildId, language);

      await interaction.reply({
        embeds: [EmbedHelper.success(i18n.t('texts.saved', guildId),
          `${i18n.t('texts.langSet', guildId, { lang: language })}\n\n${i18n.t('common.success', guildId)}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const texts = await loadTexts(guildId);

    if (sub === 'list') {
      const entries = Object.entries(texts);
      await interaction.reply({
        embeds: [EmbedHelper.info(i18n.t('texts.overridden', guildId),
          entries.length === 0
            ? i18n.t('texts.nothingOverridden', guildId)
            : entries
                .slice(0, 20)
                .map(([key, value]) => `**${key}**\n${value.length > 120 ? value.slice(0, 120) + '…' : value}`)
                .join('\n\n') +
              (entries.length > 20 ? `\n\n${i18n.t('texts.andMore', guildId, { count: String(entries.length - 20) })}` : '')
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const key = interaction.options.getString('kluc', true).trim();

    if (sub === 'show') {
      const custom = texts[key];
      const original = i18n.t(key, undefined);

      await interaction.reply({
        embeds: [EmbedHelper.info(i18n.t('texts.showTitle', guildId, { key }),
          `${i18n.t('texts.originalLabel', guildId)}\n${original === key ? i18n.t('texts.keyMissing', guildId) : original}\n\n` +
          `${i18n.t('texts.yourWording', guildId)}\n${custom || i18n.t('texts.notOverridden', guildId)}`
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'reset') {
      if (!(key in texts)) {
        await interaction.reply({
          embeds: [EmbedHelper.warning(i18n.t('texts.nothingToReset', guildId), i18n.t('texts.nothingToResetBody', guildId, { key }))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      delete texts[key];
      await saveTexts(guildId, texts);

      await interaction.reply({
        embeds: [EmbedHelper.success(i18n.t('texts.restored', guildId),
          i18n.t('texts.restoredBody', guildId, { key, text: i18n.t(key, guildId) }))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const text = interaction.options.getString('text', true);

    if (text.length > 1900) {
      await interaction.reply({
        embeds: [EmbedHelper.error(i18n.t('texts.tooLong', guildId), i18n.t('texts.tooLongBody', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    texts[key] = text;
    await saveTexts(guildId, texts);

    const placeholders = [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    const note = placeholders.length > 0
      ? `\n\n${i18n.t('texts.variablesUsed', guildId, { list: placeholders.map(p => `\`{${p}}\``).join(', ') })}`
      : '';

    await interaction.reply({
      embeds: [EmbedHelper.success(i18n.t('texts.saved', guildId), i18n.t('texts.savedBody', guildId, { key, text }) + note)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
