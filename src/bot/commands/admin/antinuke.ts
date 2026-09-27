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
  ChannelType,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const ACTIONS = [
  { name: 'Mazanie kanálov', value: 'channelDelete' },
  { name: 'Vytváranie kanálov', value: 'channelCreate' },
  { name: 'Mazanie rolí', value: 'roleDelete' },
  { name: 'Vytváranie rolí', value: 'roleCreate' },
  { name: 'Banovanie členov', value: 'ban' },
  { name: 'Vyhadzovanie členov', value: 'kick' },
  { name: 'Vytváranie webhookov', value: 'webhookCreate' },
  { name: 'Mazanie emoji', value: 'emojiDelete' },
  { name: 'Rozdávanie rolí', value: 'memberRoleUpdate' }
];

async function loadConfig(guildId: string): Promise<any> {
  const settings = await GuildSettings.findOne({ guildId });
  return (settings as any)?.antinuke || {};
}

async function saveConfig(guildId: string, config: any): Promise<void> {
  await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: { antinuke: config } },
    { upsert: true }
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Ochrana servera proti hromadnému ničeniu')
    .addSubcommand(sub => sub.setName('status').setDescription('Zobraz aktuálne nastavenie'))
    .addSubcommand(sub => sub.setName('enable').setDescription('Zapni Anti-Nuke'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Vypni Anti-Nuke'))
    .addSubcommand(sub =>
      sub.setName('punishment').setDescription('Čo sa má stať s útočníkom')
        .addStringOption(opt => opt.setName('typ').setDescription('Opatrenie').setRequired(true)
          .addChoices(
            { name: 'Odobrať role (najmiernejšie)', value: 'removeRoles' },
            { name: 'Vyhodiť zo servera', value: 'kick' },
            { name: 'Zabanovať', value: 'ban' }
          )))
    .addSubcommand(sub =>
      sub.setName('logchannel').setDescription('Kam sa majú hlásiť zásahy')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Textový kanál')
          .addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('limit').setDescription('Nastav limit pre konkrétnu akciu')
        .addStringOption(opt => opt.setName('akcia').setDescription('Sledovaná akcia').setRequired(true)
          .addChoices(...ACTIONS))
        .addIntegerOption(opt => opt.setName('max').setDescription('Koľko akcií je ešte v poriadku')
          .setMinValue(1).setMaxValue(50).setRequired(true))
        .addIntegerOption(opt => opt.setName('okno').setDescription('Za koľko sekúnd')
          .setMinValue(5).setMaxValue(600).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('toggle').setDescription('Zapni alebo vypni sledovanie akcie')
        .addStringOption(opt => opt.setName('akcia').setDescription('Sledovaná akcia').setRequired(true)
          .addChoices(...ACTIONS)))
    .addSubcommand(sub =>
      sub.setName('whitelist').setDescription('Pridaj alebo odober dôveryhodný účet či rolu')
        .addStringOption(opt => opt.setName('operacia').setDescription('Čo urobiť').setRequired(true)
          .addChoices({ name: 'Pridať', value: 'add' }, { name: 'Odobrať', value: 'remove' }))
        .addUserOption(opt => opt.setName('pouzivatel').setDescription('Dôveryhodný používateľ'))
        .addRoleOption(opt => opt.setName('rola').setDescription('Dôveryhodná rola')))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'admin',
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const config = await loadConfig(guildId);

    if (sub === 'status') {
      const limits = config.limits || {};
      const rows = ACTIONS.map(a => {
        const l = limits[a.value] || {};
        const on = l.enabled === false ? '⚪' : '🟢';
        return `${on} ${a.name} - ${l.max ?? '-'} / ${l.windowSeconds ?? '-'}s`;
      }).join('\n');

      const users = (config.whitelistUsers || []).map((id: string) => `<@${id}>`).join(', ') || 'žiadni';
      const roles = (config.whitelistRoles || []).map((id: string) => `<@&${id}>`).join(', ') || 'žiadne';

      await interaction.reply({
        embeds: [EmbedHelper.info('🛡️ Anti-Nuke',
          `**Stav:** ${config.enabled ? 'zapnutý' : 'vypnutý'}\n` +
          `**Opatrenie:** ${config.punishment || 'removeRoles'}\n` +
          `**Log kanál:** ${config.logChannel ? `<#${config.logChannel}>` : 'nenastavený'}\n\n` +
          `**Limity:**\n${rows}\n\n` +
          `**Dôveryhodní používatelia:** ${users}\n**Dôveryhodné role:** ${roles}`
        )],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      config.enabled = sub === 'enable';
      await saveConfig(guildId, config);

      const warning = config.enabled && !config.logChannel
        ? '\n\nOdporúčam nastaviť log kanál cez `/antinuke logchannel`.'
        : '';

      await interaction.reply({
        embeds: [EmbedHelper.success('Uložené',
          `Anti-Nuke je **${config.enabled ? 'zapnutý' : 'vypnutý'}**.${warning}`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'punishment') {
      config.punishment = interaction.options.getString('typ', true);
      await saveConfig(guildId, config);
      await interaction.reply({
        embeds: [EmbedHelper.success('Uložené', `Opatrenie nastavené na **${config.punishment}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('kanal', true);
      config.logChannel = channel.id;
      await saveConfig(guildId, config);
      await interaction.reply({
        embeds: [EmbedHelper.success('Uložené', `Zásahy sa budú hlásiť do <#${channel.id}>.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'limit') {
      const action = interaction.options.getString('akcia', true);
      const max = interaction.options.getInteger('max', true);
      const window = interaction.options.getInteger('okno', true);

      config.limits = config.limits || {};
      config.limits[action] = { ...(config.limits[action] || {}), enabled: true, max, windowSeconds: window };
      await saveConfig(guildId, config);

      const label = ACTIONS.find(a => a.value === action)?.name || action;
      await interaction.reply({
        embeds: [EmbedHelper.success('Uložené',
          `**${label}** - zásah po **${max}** akciách za **${window}s**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sub === 'toggle') {
      const action = interaction.options.getString('akcia', true);
      config.limits = config.limits || {};
      const current = config.limits[action] || {};
      const next = current.enabled === false;
      config.limits[action] = { ...current, enabled: next };
      await saveConfig(guildId, config);

      const label = ACTIONS.find(a => a.value === action)?.name || action;
      await interaction.reply({
        embeds: [EmbedHelper.success('Uložené',
          `Sledovanie **${label}** je ${next ? 'zapnuté' : 'vypnuté'}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const operation = interaction.options.getString('operacia', true);
    const user = interaction.options.getUser('pouzivatel');
    const role = interaction.options.getRole('rola');

    if (!user && !role) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Chýba cieľ', 'Zadaj používateľa alebo rolu.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    config.whitelistUsers = config.whitelistUsers || [];
    config.whitelistRoles = config.whitelistRoles || [];
    const changes: string[] = [];

    if (user) {
      const list: string[] = config.whitelistUsers;
      const index = list.indexOf(user.id);
      if (operation === 'add' && index === -1) { list.push(user.id); changes.push(`pridaný <@${user.id}>`); }
      if (operation === 'remove' && index !== -1) { list.splice(index, 1); changes.push(`odobraný <@${user.id}>`); }
    }

    if (role) {
      const list: string[] = config.whitelistRoles;
      const index = list.indexOf(role.id);
      if (operation === 'add' && index === -1) { list.push(role.id); changes.push(`pridaná <@&${role.id}>`); }
      if (operation === 'remove' && index !== -1) { list.splice(index, 1); changes.push(`odobraná <@&${role.id}>`); }
    }

    await saveConfig(guildId, config);
    await interaction.reply({
      embeds: [EmbedHelper.success('Uložené',
        changes.length > 0 ? changes.join('\n') : 'Nič sa nezmenilo - položka už bola v požadovanom stave.')],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
