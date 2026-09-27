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
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { GuildSettings } from '../../../utils/models.js';
import { applyNickname, validateNickname } from '../../modules/botIdentity.js';
import { invalidateGuildCache } from '../../../utils/guildCache.js';
import { languageChoices } from '../../../shared/languages.js';

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Server settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Show all settings')
    )
    .addSubcommand(sub =>
      sub.setName('module')
        .setDescription('Zapni/vypni modul')
        .addStringOption(opt =>
          opt.setName('modul')
            .setDescription('Module name')
            .setRequired(true)
            .addChoices(
              { name: 'Leveling (XP)', value: 'leveling' },
              { name: 'Economy (Coins)', value: 'economy' },
              { name: 'Moderation', value: 'moderation' },
              { name: 'Tickets', value: 'tickets' },
              { name: 'Suggestions', value: 'suggestions' },
              { name: 'Verification', value: 'verification' },
              { name: 'Welcome', value: 'welcome' },
              { name: 'Goodbye', value: 'goodbye' },
              { name: 'Logs', value: 'logs' },
              { name: 'Starboard', value: 'starboard' },
              { name: 'Anti-Raid', value: 'antiRaid' },
              { name: 'Anti-Ad', value: 'antiAd' },
              { name: 'Filter', value: 'filter' },
              { name: 'Temp Channels', value: 'tempChannels' },
              { name: 'Invites Tracking', value: 'invites' },
              { name: 'Message Stats', value: 'messageStats' },
              { name: 'Voice Stats', value: 'voiceStats' },
              { name: 'Giveaways', value: 'giveaways' },
              { name: 'Fun/Games', value: 'fun' },
              { name: 'Social Feeds', value: 'socialFeeds' }
            )
        )
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable/Disable')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('welcome')
        .setDescription('Configure welcome messages')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel for welcome messages')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(opt =>
          opt.setName('message')
            .setDescription('Welcome message ({user}, {server}, {memberCount})')
        )
    )
    .addSubcommand(sub =>
      sub.setName('goodbye')
        .setDescription('Configure goodbye messages')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel for goodbye messages')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(opt =>
          opt.setName('message')
            .setDescription('Goodbye message ({user}, {server})')
        )
    )
    .addSubcommand(sub =>
      sub.setName('leveling')
        .setDescription('Nastavenie levelingu')
        .addIntegerOption(opt =>
          opt.setName('xp')
            .setDescription('XP per message')
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addIntegerOption(opt =>
          opt.setName('cooldown')
            .setDescription('Cooldown in seconds')
            .setMinValue(0)
            .setMaxValue(300)
        )
        .addChannelOption(opt =>
          opt.setName('announce')
            .setDescription('Channel for level-up announcements')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('economy')
        .setDescription('Nastavenie ekonomiky')
        .addStringOption(opt =>
          opt.setName('currency')
            .setDescription('Currency name')
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji meny')
        )
        .addIntegerOption(opt =>
          opt.setName('daily')
            .setDescription('Daily odmena')
            .setMinValue(1)
        )
        .addIntegerOption(opt =>
          opt.setName('weekly')
            .setDescription('Weekly odmena')
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('starboard')
        .setDescription('Nastavenie starboardu')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Starboard channel')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addIntegerOption(opt =>
          opt.setName('threshold')
            .setDescription('Number of stars required')
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji pre starboard')
        )
    )
    .addSubcommand(sub =>
      sub.setName('tempchannels')
        .setDescription('Configure temp channels')
        .addChannelOption(opt =>
          opt.setName('trigger')
            .setDescription('Voice channel for creation')
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Category for temp channels')
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Default name ({user})')
        )
    )
    .addSubcommand(sub =>
      sub.setName('prefix')
        .setDescription('Change the bot prefix')
        .addStringOption(opt =>
          opt.setName('prefix')
            .setDescription('New prefix')
            .setRequired(true)
            .setMaxLength(5)
        )
    )
    .addSubcommand(sub =>
      sub.setName('language')
        .setDescription('Change the bot language')
        .addStringOption(opt =>
          opt.setName('lang')
            .setDescription('Jazyk')
            .setRequired(true)
            .addChoices(...languageChoices())
        )
    )
    .addSubcommand(sub =>
      sub.setName('nickname')
        .setDescription('Meno bota na tomto serveri')
        .addStringOption(opt =>
          opt.setName('meno')
            .setDescription('Nové meno, alebo "reset" pre návrat na globálne')
            .setRequired(true)
            .setMaxLength(32)
        )
    ),

  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const settings = await GuildSettings.findOne({ guildId: interaction.guildId }) || {};

    if (subcommand === 'view') {
      const modules = settings.modules || {};

      const moduleList = [
        { name: 'Leveling', key: 'leveling', emoji: '📈' },
        { name: 'Economy', key: 'economy', emoji: '💰' },
        { name: 'Moderation', key: 'moderation', emoji: '🔨' },
        { name: 'Tickets', key: 'tickets', emoji: '🎫' },
        { name: 'Suggestions', key: 'suggestions', emoji: '💡' },
        { name: 'Verification', key: 'verification', emoji: '✅' },
        { name: 'Welcome', key: 'welcome', emoji: '👋' },
        { name: 'Goodbye', key: 'goodbye', emoji: '👋' },
        { name: 'Logs', key: 'logs', emoji: '📋' },
        { name: 'Starboard', key: 'starboard', emoji: '⭐' },
        { name: 'Anti-Raid', key: 'antiRaid', emoji: '🛡️' },
        { name: 'Anti-Ad', key: 'antiAd', emoji: '🚫' },
        { name: 'Filter', key: 'filter', emoji: '🔇' },
        { name: 'Temp Channels', key: 'tempChannels', emoji: '🔊' },
        { name: 'Invites', key: 'invites', emoji: '📨' },
        { name: 'Message Stats', key: 'messageStats', emoji: '💬' },
        { name: 'Voice Stats', key: 'voiceStats', emoji: '🎤' },
        { name: 'Giveaways', key: 'giveaways', emoji: '🎉' },
        { name: 'Fun/Games', key: 'fun', emoji: '🎮' },
        { name: 'Social Feeds', key: 'socialFeeds', emoji: '📡' }
      ];

      const enabled = moduleList
        .filter(m => modules[m.key]?.enabled !== false)
        .map(m => `${m.emoji} ${m.name}`)
        .join('\n') || 'None';

      const disabled = moduleList
        .filter(m => modules[m.key]?.enabled === false)
        .map(m => `${m.emoji} ${m.name}`)
        .join('\n') || 'None';

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Server settings')
        .addFields(
          { name: 'Prefix', value: `\`${settings.prefix || '!'}\``, inline: true },
          { name: 'Jazyk', value: settings.language || 'en', inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '✅ Enabled modules', value: enabled, inline: true },
          { name: '❌ Disabled modules', value: disabled, inline: true }
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'Use /settings module to change' });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'module') {
      const moduleName = interaction.options.getString('modul', true);
      const enabled = interaction.options.getBoolean('enabled', true);

      if (!settings.modules) settings.modules = {};
      if (!settings.modules[moduleName]) settings.modules[moduleName] = {};
      settings.modules[moduleName].enabled = enabled;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${enabled ? '✅' : '❌'} Modul ${moduleName}`)
            .setDescription(`Module is now ${enabled ? 'enabled' : 'disabled'}.`)
            .setColor(enabled ? 0x00FF00 : 0xFF0000)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'welcome') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.welcome) settings.modules.welcome = { enabled: true };

      if (channel) settings.modules.welcome.channel = channel.id;
      if (message) settings.modules.welcome.message = message;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Welcome set')
        .setColor(0x00FF00);

      if (channel) embed.addFields({ name: 'Channel', value: `${channel}`, inline: true });
      if (message) embed.addFields({ name: 'Message', value: message, inline: true });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'goodbye') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.goodbye) settings.modules.goodbye = { enabled: true };

      if (channel) settings.modules.goodbye.channel = channel.id;
      if (message) settings.modules.goodbye.message = message;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        content: '✅ Goodbye settings saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'leveling') {
      const xp = interaction.options.getInteger('xp');
      const cooldown = interaction.options.getInteger('cooldown');
      const announce = interaction.options.getChannel('announce');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.leveling) settings.modules.leveling = { enabled: true };

      if (xp) settings.modules.leveling.xpPerMessage = xp;
      if (cooldown !== null) settings.modules.leveling.xpCooldown = cooldown;
      if (announce) settings.modules.leveling.levelUpChannel = announce.id;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        content: '✅ Leveling settings saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'economy') {
      const currency = interaction.options.getString('currency');
      const emoji = interaction.options.getString('emoji');
      const daily = interaction.options.getInteger('daily');
      const weekly = interaction.options.getInteger('weekly');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.economy) settings.modules.economy = { enabled: true };

      if (currency) settings.modules.economy.currencyName = currency;
      if (emoji) settings.modules.economy.currencyEmoji = emoji;
      if (daily) settings.modules.economy.dailyAmount = daily;
      if (weekly) settings.modules.economy.weeklyAmount = weekly;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        content: '✅ Economy settings saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'starboard') {
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold');
      const emoji = interaction.options.getString('emoji');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.starboard) settings.modules.starboard = { enabled: true };

      if (channel) settings.modules.starboard.channel = channel.id;
      if (threshold) settings.modules.starboard.threshold = threshold;
      if (emoji) settings.modules.starboard.emoji = emoji;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        content: '✅ Starboard settings saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'tempchannels') {
      const trigger = interaction.options.getChannel('trigger');
      const category = interaction.options.getChannel('category');
      const name = interaction.options.getString('name');

      if (!settings.modules) settings.modules = {};
      if (!settings.modules.tempChannels) settings.modules.tempChannels = { enabled: true };

      if (trigger) settings.modules.tempChannels.triggerChannel = trigger.id;
      if (category) settings.modules.tempChannels.category = category.id;
      if (name) settings.modules.tempChannels.defaultName = name;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { modules: settings.modules } },
        { upsert: true }
      );

      await interaction.reply({
        content: '✅ Temp Channels settings saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'prefix') {
      const prefix = interaction.options.getString('prefix', true);

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { prefix } },
        { upsert: true }
      );

      await interaction.reply({
        content: `✅ Prefix changed to \`${prefix}\``,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'nickname') {
      const raw = interaction.options.getString('meno', true).trim();
      const clearing = ['reset', 'default', 'none', 'zrusit', 'zrušiť'].includes(raw.toLowerCase());

      if (!clearing) {
        const check = validateNickname(raw);
        if (!check.valid) {
          await interaction.reply({ content: `❌ ${check.error}`, flags: MessageFlags.Ephemeral });
          return;
        }
      }

      const nickname = clearing ? null : raw;

      const result = await applyNickname(interaction.guild!, nickname);
      if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.reason}`, flags: MessageFlags.Ephemeral });
        return;
      }

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { bot_nickname: nickname || '' } },
        { upsert: true }
      );
      invalidateGuildCache();

      await interaction.reply({
        content: clearing
          ? '✅ Bot sa na tomto serveri volá zase svojím globálnym menom.'
          : `✅ Bot sa na tomto serveri volá **${nickname}**. Na iných serveroch to nič nemení.`,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'language') {
      const lang = interaction.options.getString('lang', true);

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { language: lang } },
        { upsert: true }
      );

      await interaction.reply({
        content: `✅ Language changed to ${lang}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
