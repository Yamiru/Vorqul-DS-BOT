/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, VoiceChannel, MessageFlags } from 'discord.js';
import { getDatabase } from '../../../utils/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tempchannel')
    .setDescription('Manage your temporary voice channel')
    .addSubcommand(sub =>
      sub.setName('name')
        .setDescription('Rename the channel')
        .addStringOption(opt =>
          opt.setName('nazov')
            .setDescription('New name')
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand(sub =>
      sub.setName('limit')
        .setDescription('Set the user limit')
        .addIntegerOption(opt =>
          opt.setName('pocet')
            .setDescription('Maximum count (0 = unlimited)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand(sub =>
      sub.setName('private')
        .setDescription('Switch the channel to private')
    )
    .addSubcommand(sub =>
      sub.setName('public')
        .setDescription('Switch the channel to public')
    )
    .addSubcommand(sub =>
      sub.setName('allow')
        .setDescription('Allow a user to join')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('deny')
        .setDescription('Deny a user access')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('transfer')
        .setDescription('Transfer channel ownership')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('New owner')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Remove a user from the channel')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Information about your temp channel')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    const tempChannel = await db.findOne('temp_channels', {
      guild_id: interaction.guildId,
      owner_id: interaction.user.id
    });

    if (!tempChannel && subcommand !== 'info') {
      return interaction.reply({
        content: '❌ You do not have any temporary channel. Join the trigger channel to create one.',
        flags: MessageFlags.Ephemeral
      });
    }

    const channel = interaction.guild?.channels.cache.get(tempChannel?.channel_id) as VoiceChannel | undefined;

    if (!channel && subcommand !== 'info') {
      await db.delete('temp_channels', { id: tempChannel.id });
      return interaction.reply({
        content: '❌ Your temporary channel no longer exists.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'name') {
      const name = interaction.options.getString('nazov', true);
      await channel!.setName(name);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Name changed')
            .setDescription(`New name: **${name}**`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'limit') {
      const limit = interaction.options.getInteger('pocet', true);
      await channel!.setUserLimit(limit);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Limit set')
            .setDescription(limit === 0 ? 'Bez limitu' : `Max. ${limit} users`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'private') {
      await channel!.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        Connect: false
      });

      await db.update('temp_channels', { is_private: true }, { id: tempChannel.id });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔒 The channel is now private')
            .setDescription('Use `/tempchannel allow` to add users.')
            .setColor(0xFF6B6B)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'public') {
      await channel!.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        Connect: null
      });

      await db.update('temp_channels', { is_private: false }, { id: tempChannel.id });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔓 The channel is now public')
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'allow') {
      const user = interaction.options.getUser('user', true);
      await channel!.permissionOverwrites.edit(user.id, {
        Connect: true,
        ViewChannel: true
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User added')
            .setDescription(`${user} can now enter the channel.`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'deny') {
      const user = interaction.options.getUser('user', true);

      if (user.id === interaction.user.id) {
        return interaction.reply({
          content: '❌ You cannot ban yourself.',
          flags: MessageFlags.Ephemeral
        });
      }

      await channel!.permissionOverwrites.edit(user.id, {
        Connect: false
      });

      const member = interaction.guild?.members.cache.get(user.id);
      if (member?.voice.channelId === channel!.id) {
        await member.voice.disconnect('Kicked from the temp channel');
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 User blocked')
            .setDescription(`${user} can no longer enter the channel.`)
            .setColor(0xFF6B6B)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'transfer') {
      const user = interaction.options.getUser('user', true);

      if (user.bot) {
        return interaction.reply({
          content: '❌ You cannot transfer ownership to a bot.',
          flags: MessageFlags.Ephemeral
        });
      }

      await db.update('temp_channels', { owner_id: user.id }, { id: tempChannel.id });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Ownership transferred')
            .setDescription(`${user} is now the owner of the channel.`)
            .setColor(0x00FF00)
        ]
      });
    }

    else if (subcommand === 'kick') {
      const user = interaction.options.getUser('user', true);

      if (user.id === interaction.user.id) {
        return interaction.reply({
          content: '❌ You cannot kick yourself.',
          flags: MessageFlags.Ephemeral
        });
      }

      const member = interaction.guild?.members.cache.get(user.id);
      if (member?.voice.channelId !== channel!.id) {
        return interaction.reply({
          content: '❌ User is not in your channel.',
          flags: MessageFlags.Ephemeral
        });
      }

      await member.voice.disconnect('Kicked by the temp channel owner');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('👢 User kicked')
            .setDescription(`${user} was kicked from the channel.`)
            .setColor(0xFF6B6B)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'info') {
      if (!tempChannel) {
        return interaction.reply({
          content: '📭 You do not have any temporary channel.',
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔊 Your Temp Channel')
        .addFields(
          { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Neexistuje', inline: true },
          { name: 'Stav', value: tempChannel.is_private ? '🔒 Private' : '🔓 Public', inline: true },
          { name: 'Limit', value: channel?.userLimit ? `${channel.userLimit}` : 'Bez limitu', inline: true }
        )
        .setColor(0x3498DB);

      if (channel) {
        embed.addFields({
          name: 'Currently in channel',
          value: channel.members.size > 0
            ? channel.members.map(m => `<@${m.id}>`).join(', ')
            : 'Nikto'
        });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};
