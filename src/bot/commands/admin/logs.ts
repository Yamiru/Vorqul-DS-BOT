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

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure the logging system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Zapni logging')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Vypni logging')
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the channel for a log type')
        .addStringOption(opt =>
          opt.setName('typ')
            .setDescription('Typ logov')
            .setRequired(true)
            .addChoices(
              { name: 'Messages (edit/delete)', value: 'messages' },
              { name: 'Members (join/leave)', value: 'members' },
              { name: 'Moderation (ban/kick/warn)', value: 'moderation' },
              { name: 'Voice (join/leave/move)', value: 'voice' },
              { name: 'Server (role/channel)', value: 'server' },
              { name: 'All', value: 'all' }
            )
        )
        .addChannelOption(opt =>
          opt.setName('kanal')
            .setDescription('Channel for logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Toggle a specific log type')
        .addStringOption(opt =>
          opt.setName('event')
            .setDescription('Typ eventu')
            .setRequired(true)
            .addChoices(
              { name: 'Message edit', value: 'messageEdit' },
              { name: 'Message deletion', value: 'messageDelete' },
              { name: 'Bulk delete', value: 'messageBulkDelete' },
              { name: 'Member joined', value: 'memberJoin' },
              { name: 'Member left', value: 'memberLeave' },
              { name: 'Voice join', value: 'voiceJoin' },
              { name: 'Voice leave', value: 'voiceLeave' },
              { name: 'Voice move', value: 'voiceMove' },
              { name: 'Ban', value: 'ban' },
              { name: 'Unban', value: 'unban' },
              { name: 'Kick', value: 'kick' },
              { name: 'Warn', value: 'warn' },
              { name: 'Role created', value: 'roleCreate' },
              { name: 'Role deleted', value: 'roleDelete' },
              { name: 'Channel created', value: 'channelCreate' },
              { name: 'Channel deleted', value: 'channelDelete' },
              { name: 'Nickname change', value: 'nicknameChange' },
              { name: 'Command usage', value: 'commandUsed' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show current settings')
    )
    .addSubcommand(sub =>
      sub.setName('ignore')
        .setDescription('Ignore a channel in the logs')
        .addChannelOption(opt =>
          opt.setName('kanal')
            .setDescription('Channel to ignore')
            .setRequired(true)
        )
    ),

  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const settings = await GuildSettings.findOne({ guildId: interaction.guildId }) || {};
    const logs = settings.logs || {
      enabled: false,
      channels: {},
      events: {
        messageEdit: true,
        messageDelete: true,
        messageBulkDelete: true,
        memberJoin: true,
        memberLeave: true,
        voiceJoin: true,
        voiceLeave: true,
        voiceMove: true,
        ban: true,
        unban: true,
        kick: true,
        warn: true,
        roleCreate: true,
        roleDelete: true,
        channelCreate: true,
        channelDelete: true,
        nicknameChange: true,
        commandUsed: false
      },
      blacklistChannels: []
    };

    if (subcommand === 'enable') {
      logs.enabled = true;
      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { logs } },
        { upsert: true }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Logging enabled')
            .setDescription('Remember to set channels with `/logs channel`')
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'disable') {
      logs.enabled = false;
      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { logs } },
        { upsert: true }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Logging disabled')
            .setColor(0xFF0000)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'channel') {
      const type = interaction.options.getString('typ', true);
      const channel = interaction.options.getChannel('kanal', true);

      if (!logs.channels) logs.channels = {};

      if (type === 'all') {
        logs.channels.messages = channel.id;
        logs.channels.members = channel.id;
        logs.channels.moderation = channel.id;
        logs.channels.voice = channel.id;
        logs.channels.server = channel.id;
      } else {
        logs.channels[type] = channel.id;
      }

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { logs } },
        { upsert: true }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Channel set')
            .setDescription(`${type === 'all' ? 'All logy' : type} → ${channel}`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'toggle') {
      const event = interaction.options.getString('event', true);

      if (!logs.events) logs.events = {};
      logs.events[event] = !logs.events[event];

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { logs } },
        { upsert: true }
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${logs.events[event] ? '✅' : '❌'} ${event}`)
            .setDescription(`Event is now ${logs.events[event] ? 'enabled' : 'disabled'}`)
            .setColor(logs.events[event] ? 0x00FF00 : 0xFF0000)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'status') {
      const embed = new EmbedBuilder()
        .setTitle('📋 Nastavenia Logov')
        .setColor(logs.enabled ? 0x00FF00 : 0xFF0000)
        .addFields(
          { name: 'Stav', value: logs.enabled ? '✅ Enabled' : '❌ Disabled', inline: true }
        );

      const channels = logs.channels || {};
      const channelList = Object.entries(channels)
        .map(([type, id]) => `**${type}:** <#${id}>`)
        .join('\n') || 'None set';

      embed.addFields({ name: '📺 Channels', value: channelList });

      const events = logs.events || {};
      const enabledEvents = Object.entries(events)
        .filter(([_, enabled]) => enabled)
        .map(([event]) => event)
        .join(', ') || 'None';

      embed.addFields({ name: '✅ Enabled events', value: enabledEvents });

      const ignored = logs.blacklistChannels || [];
      embed.addFields({
        name: '🚫 Ignored channels',
        value: ignored.length > 0 ? ignored.map((id: string) => `<#${id}>`).join(', ') : 'None'
      });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'ignore') {
      const channel = interaction.options.getChannel('kanal', true);

      if (!logs.blacklistChannels) logs.blacklistChannels = [];

      const index = logs.blacklistChannels.indexOf(channel.id);
      if (index > -1) {
        logs.blacklistChannels.splice(index, 1);
        await GuildSettings.updateOne(
          { guildId: interaction.guildId },
          { $set: { logs } },
          { upsert: true }
        );

        await interaction.reply({
          content: `✅ ${channel} was removed from the ignored channels.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        logs.blacklistChannels.push(channel.id);
        await GuildSettings.updateOne(
          { guildId: interaction.guildId },
          { $set: { logs } },
          { upsert: true }
        );

        await interaction.reply({
          content: `✅ ${channel} will be ignored in the logs.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};
