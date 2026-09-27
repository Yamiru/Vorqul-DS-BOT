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
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings, Ticket } from '../../../utils/models.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';
import { suppress } from '../../../utils/suppress.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket support system')
    .addSubcommand(sub =>
      sub.setName('create').setDescription('Create a new support ticket')
    )
    .addSubcommand(sub =>
      sub.setName('close').setDescription('Close the current ticket')
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to the ticket')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to add').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the ticket')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup ticket panel (Admin)')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel for ticket panel').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('transcript').setDescription('Generate ticket transcript')
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    const settings = await GuildSettings.findOne({ guildId });

    switch (subcommand) {
      case 'create': {
        if (!settings?.tickets?.enabled) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Disabled', 'Ticket system is not enabled on this server.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const existingTicket = await Ticket.findOne({
          guildId,
          odId: interaction.user.id,
          status: { $in: ['open', 'claimed'] }
        });

        if (existingTicket) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Exists', `You already have an open ticket: <#${existingTicket.channelId || existingTicket.channel_id}>`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: settings.tickets.categoryId || undefined,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: ['ViewChannel']
            },
            {
              id: interaction.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
            },
            {
              id: interaction.client.user!.id,
              allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ManageMessages']
            },

            ...((settings.tickets.supportRoles || []).map((roleId: string) => ({
              id: roleId,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] as any
            })))
          ]
        });

        const ticketNumber = await Ticket.nextNumber(guildId);
        await Ticket.create({
          guildId,
          odId: interaction.user.id,
          channelId: ticketChannel.id,
          ticketNumber,
          status: 'open',
          createdAt: new Date()
        });

        const welcomeEmbed = new EmbedBuilder()
          .setTitle('🎫 Support Ticket')
          .setDescription(
            settings.tickets.welcomeMessage ||
            'Welcome to your ticket! Describe your problem and we will get back to you soon.'
          )
          .setColor(config.bot.embedColor as `#${string}`)
          .addFields(
            { name: 'Vytvoril', value: `${interaction.user}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setTimestamp();

        const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_transcript')
            .setLabel('Transcript')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `${interaction.user} ${settings.tickets.supportRoles?.map((r: string) => `<@&${r}>`).join(' ') || ''}`,
          embeds: [welcomeEmbed],
          components: [closeRow]
        });

        await interaction.editReply({
          embeds: [EmbedHelper.success('Ticket Created', `Your ticket has been created: ${ticketChannel}`)]
        });
        break;
      }

      case 'close': {
        const channel = interaction.channel as TextChannel;

        if (!channel.name.startsWith('ticket-')) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This is not a ticket channel.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (settings?.tickets?.closeConfirmation) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close_confirm')
              .setLabel('Confirm close')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('ticket_close_cancel')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.reply({
            embeds: [EmbedHelper.warning('Confirm', 'Are you sure you want to close this ticket?')],
            components: [row]
          });
        } else {
          await closeTicket(interaction, channel, settings);
        }
        break;
      }

      case 'add': {
        const channel = interaction.channel as TextChannel;
        const user = interaction.options.getUser('user', true);

        if (!channel.name.startsWith('ticket-')) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This is not a ticket channel.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        await interaction.reply({
          embeds: [EmbedHelper.success('Added', `${user} has been added to this ticket.`)]
        });
        break;
      }

      case 'remove': {
        const channel = interaction.channel as TextChannel;
        const user = interaction.options.getUser('user', true);

        if (!channel.name.startsWith('ticket-')) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This is not a ticket channel.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await channel.permissionOverwrites.delete(user.id);

        await interaction.reply({
          embeds: [EmbedHelper.success('Removed', `${user} has been removed from this ticket.`)]
        });
        break;
      }

      case 'setup': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: 'You need Administrator permission.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const channel = interaction.options.getChannel('channel', true) as TextChannel;

        const embed = new EmbedBuilder()
          .setTitle('🎫 Support Tickets')
          .setDescription(
            'Need help? Click the button below to create a ticket.\n\n' +
            '**Rules:**\n' +
            '• Be patient - we will reply as soon as possible\n' +
            '• Describe your problem in detail\n' +
            '• Do not create multiple tickets for the same issue'
          )
          .setColor(config.bot.embedColor as `#${string}`)
          .setFooter({ text: 'Vorqul DS BOT Ticket System' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create')
            .setLabel('Create a ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({
          embeds: [EmbedHelper.success('Setup Complete', `Ticket panel has been created in ${channel}`)],
          flags: MessageFlags.Ephemeral
        });
        break;
      }

      case 'transcript': {
        const channel = interaction.channel as TextChannel;

        if (!channel.name.startsWith('ticket-')) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This is not a ticket channel.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.deferReply();

        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = [...messages.values()].reverse();

        let transcript = `# Ticket Transcript: ${channel.name}\n`;
        transcript += `Generated: ${new Date().toISOString()}\n\n`;
        transcript += `---\n\n`;

        for (const msg of sortedMessages) {
          const time = msg.createdAt.toISOString();
          transcript += `[${time}] ${msg.author.tag}:\n`;
          transcript += `${msg.content || '[No text content]'}\n`;
          if (msg.attachments.size > 0) {
            transcript += `Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
          }
          transcript += `\n`;
        }

        const buffer = Buffer.from(transcript, 'utf-8');

        await interaction.editReply({
          content: '📝 Ticket transcript:',
          files: [{ attachment: buffer, name: `transcript-${channel.name}.txt` }]
        });
        break;
      }
    }
  }
};

async function closeTicket(interaction: ChatInputCommandInteraction, channel: TextChannel, settings: any) {
  await interaction.reply({
    embeds: [EmbedHelper.info('Closing', 'This ticket will be closed in 5 seconds...')]
  });

  const record = await Ticket.findOne({ guildId: interaction.guildId!, channelId: channel.id });
  if (record) {
    record.status = 'closed';
    record.closedBy = interaction.user.id;
    record.closedAt = new Date();
    await record.save().catch(() => {});
  }

  if (settings?.tickets?.transcriptChannel) {
    const transcriptChannel = interaction.guild!.channels.cache.get(settings.tickets.transcriptChannel) as TextChannel;

    if (transcriptChannel) {
      const messages = await channel.messages.fetch({ limit: 100 });
      const sortedMessages = [...messages.values()].reverse();

      let transcript = `# Ticket Transcript: ${channel.name}\n`;
      transcript += `Closed by: ${interaction.user.tag}\n`;
      transcript += `Generated: ${new Date().toISOString()}\n\n---\n\n`;

      for (const msg of sortedMessages) {
        transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[No text]'}\n`;
      }

      const buffer = Buffer.from(transcript, 'utf-8');

      await transcriptChannel.send({
        content: `📝 Transcript for **${channel.name}** (closed by ${interaction.user})`,
        files: [{ attachment: buffer, name: `transcript-${channel.name}.txt` }]
      });
    }
  }

  setTimeout(async () => {
    await channel.delete().catch(suppress('ticket'));
  }, 5000);
}

export default command;
