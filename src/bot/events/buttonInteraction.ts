/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, Interaction, ButtonInteraction, ChannelType, PermissionFlagsBits, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Giveaway, GuildSettings, Ticket } from '../../utils/models.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import type { Event } from '../types.js';
import { reportError } from '../../utils/errorReporter.js';
import { logger } from '../../utils/logger.js';
import { getDangerousRolePermissions } from '../../utils/helpers.js';
import { getDatabase } from '../../utils/database.js';

const recordLocks = new Map<string, Promise<void>>();

function withRecordLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = recordLocks.get(key) || Promise.resolve();
  const result = previous.then(task, task);
  const cleanup = result.then(() => {}, () => {});
  recordLocks.set(key, cleanup);
  cleanup.finally(() => {
    if (recordLocks.get(key) === cleanup) recordLocks.delete(key);
  });
  return result;
}

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,

  execute: async (client: Client, interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const button = interaction as ButtonInteraction;

    if (button.customId === 'ticket_create' || button.customId.startsWith('ticket_create_')) {
      await handleTicketCreate(button);
      return;
    }

    if (button.customId === 'ticket_close_confirm') {
      await handleTicketCloseConfirm(button);
      return;
    }
    if (button.customId === 'ticket_close_cancel') {
      await button.update({ content: 'Close cancelled.', components: [], embeds: [] });
      return;
    }

    if (button.customId === 'ticket_close' || button.customId.startsWith('ticket_close_')) {
      await handleTicketClose(button);
      return;
    }

    if (button.customId === 'ticket_transcript') {
      await handleTicketTranscript(button);
      return;
    }

    if (button.customId.startsWith('ticket_claim_')) {
      await handleTicketClaim(button);
      return;
    }

    if (button.customId.startsWith('ticket_delete_')) {
      await handleTicketDelete(button);
      return;
    }

    if (button.customId.startsWith('ticket_reopen_')) {
      await handleTicketReopen(button);
      return;
    }

    if (button.customId.startsWith('verify_')) {
      await handleVerification(button);
      return;
    }

    if (button.customId.startsWith('rr_')) {
      await handleReactionRole(button);
      return;
    }

    if (button.customId.startsWith('role_')) {
      await handleRoleMenuButton(button);
      return;
    }

    if (button.customId.startsWith('suggest_upvote_') || button.customId.startsWith('suggest_downvote_')) {
      await handleSuggestionVote(button);
      return;
    }

    if (button.customId === 'giveaway_enter') {
      await withRecordLock(`giveaway:${button.message.id}`, async () => {
      const giveaway = await Giveaway.findOne({
        messageId: button.message.id,
        ended: false
      });

      if (!giveaway) {
        await button.reply({
          embeds: [EmbedHelper.error('Error', 'This giveaway has ended or no longer exists.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (giveaway.participants.includes(button.user.id)) {
        await button.reply({
          embeds: [EmbedHelper.info('Already Entered', 'You are already in this giveaway!')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (giveaway.requiredRole) {
        const member = await button.guild!.members.fetch(button.user.id);
        if (!member.roles.cache.has(giveaway.requiredRole)) {
          await button.reply({
            embeds: [
              EmbedHelper.error(
                'Role Required',
                `You need the <@&${giveaway.requiredRole}> role to enter this giveaway.`
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      giveaway.participants.push(button.user.id);
      await giveaway.save();

      await button.reply({
        embeds: [
          EmbedHelper.success(
            '🎉 Entered!',
            `You have entered the giveaway for **${giveaway.prize}**!\n\n` +
            `Total entries: ${giveaway.participants.length}`
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      });
    }

    if (button.customId === 'mm_join' || button.customId === 'mm_leave') {
      await withRecordLock(`matchmaking:${button.channelId}`, async () => {
      const { MatchmakingQueue } = await import('../../utils/models.js');
      const queue = await MatchmakingQueue.findOne({
        channelId: button.channelId,
        status: 'open'
      });

      if (!queue) {
        await button.reply({
          content: 'This queue is no longer active.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (button.customId === 'mm_join') {
        if (queue.players.some((p: any) => p.odId === button.user.id)) {
          await button.reply({
            content: 'You are already in the queue.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const totalNeeded = queue.teamSize * (queue.teams || 2);
        if (queue.players.length >= totalNeeded) {
          await button.reply({
            content: 'Queue is full!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        queue.players.push({ odId: button.user.id, joinedAt: new Date(), rank: 'unranked' });
        await queue.save();

        await button.reply({
          content: `✅ You joined the queue! (${queue.players.length}/${totalNeeded})`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        const idx = queue.players.findIndex((p: any) => p.odId === button.user.id);
        if (idx === -1) {
          await button.reply({
            content: 'You are not in the queue.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        queue.players.splice(idx, 1);
        await queue.save();

        await button.reply({
          content: '❌ You left the queue.',
          flags: MessageFlags.Ephemeral
        });
      }
      });
    }
  }
};

async function handleSuggestionVote(button: ButtonInteraction) {
  const guildId = button.guildId;
  const parts = button.customId.split('_');
  const value = parts[1] === 'upvote' ? 'up' : 'down';
  const id = parseInt(parts[2], 10);
  if (!guildId || !Number.isFinite(id)) return;

  const db = getDatabase();
  const outcome = await withRecordLock(`suggestion:${id}`, async () => {
    const suggestion: any = await db.findOne('suggestions', { id, guild_id: guildId });
    if (!suggestion) return { error: 'This suggestion no longer exists.' };
    if (suggestion.status && suggestion.status !== 'pending') {
      return { error: 'Voting on this suggestion is closed.' };
    }

    const where = { suggestion_id: id, user_id: button.user.id };
    const existing: any = await db.findOne('suggestion_votes', where);
    if (existing && existing.vote === value) {
      await db.delete('suggestion_votes', where);
    } else if (existing) {
      await db.update('suggestion_votes', { vote: value }, where);
    } else {
      await db.insert('suggestion_votes', { guild_id: guildId, ...where, vote: value });
    }

    const votes: any[] = await db.find('suggestion_votes', { suggestion_id: id });
    const upvotes = votes.filter(v => v.vote === 'up').length;
    const downvotes = votes.filter(v => v.vote === 'down').length;
    await db.update('suggestions', { upvotes, downvotes }, { id });
    return { upvotes, downvotes };
  });

  if ('error' in outcome) {
    await button.reply({ content: `❌ ${outcome.error}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const base = button.message.embeds[0];
  if (!base) {
    await button.deferUpdate();
    return;
  }
  const embed = EmbedBuilder.from(base);
  const fields = (base.fields || []).map(f =>
    f.name.startsWith('👍') ? { ...f, value: `${outcome.upvotes} za | ${outcome.downvotes} proti` } : f
  );
  embed.setFields(fields);
  await button.update({ embeds: [embed] });
}

async function handleTicketCreate(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const settings = await GuildSettings.findOne({ guildId: button.guildId });
    if (!settings?.tickets?.enabled) {
      await button.editReply({ content: '❌ The ticket system is not enabled.' });
      return;
    }

    const catMatch = button.customId.match(/_cat(\d+)$/);
    const cats: any[] = Array.isArray(settings.tickets.categories) ? settings.tickets.categories : [];
    const cat: any = catMatch ? cats[parseInt(catMatch[1], 10)] : null;
    const ticketParent: string | undefined = (cat && cat.categoryId) || settings.tickets.categoryId || undefined;
    const ticketSupportRoles: string[] = (cat && Array.isArray(cat.supportRoles) && cat.supportRoles.length)
      ? cat.supportRoles
      : (settings.tickets.supportRoles || []);
    const ticketWelcome: string = (cat && cat.welcomeMessage) || settings.tickets.welcomeMessage
      || 'Welcome to your ticket! Describe your problem and we will get back to you soon.';
    const ticketCatLabel: string | null = (cat && cat.label) ? cat.label : null;

    const existingTicket = await Ticket.findOne({
      guildId: button.guildId,
      odId: button.user.id,
      status: { $in: ['open', 'claimed'] }
    });

    if (existingTicket) {
      await button.editReply({
        content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`
      });
      return;
    }

    const ticketCount = await Ticket.nextNumber(button.guildId!);

    const channel = await button.guild!.channels.create({
      name: `ticket-${ticketCount.toString().padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: ticketParent,
      permissionOverwrites: [
        {
          id: button.guild!.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: button.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: button.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages
          ]
        },
        ...ticketSupportRoles.map((roleId: string) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }))
      ]
    });

    await Ticket.create({
      guildId: button.guildId!,
      odId: button.user.id,
      channelId: channel.id,
      ticketNumber: ticketCount,
      status: 'open',
      createdAt: new Date()
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(ticketCatLabel ? `🎫 Ticket: ${ticketCatLabel}` : '🎫 Ticket created')
      .setDescription(
        ticketWelcome
      )
      .setColor(0x5865F2)
      .addFields(
        { name: 'Ticket', value: `#${ticketCount}`, inline: true },
        { name: 'Vytvoril', value: `<@${button.user.id}>`, inline: true },
        { name: 'Status', value: '🟢 Open', inline: true }
      )
      .setFooter({ text: 'Vorqul DS BOT • Ticket System' })
      .setTimestamp();

    const ticketButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${channel.id}`)
          .setLabel('📋 Claim')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${channel.id}`)
          .setLabel('🔒 Close')
          .setStyle(ButtonStyle.Danger)
      );

    await channel.send({
      content: `<@${button.user.id}> ${ticketSupportRoles.map((r: string) => `<@&${r}>`).join(' ')}`,
      embeds: [welcomeEmbed],
      components: [ticketButtons]
    });

    await button.editReply({
      content: `✅ Ticket created! <#${channel.id}>`
    });
  } catch (error) {
    logger.error('Error creating ticket:', error);
    await button.editReply({ content: '❌ An error occurred while creating the ticket.' });
  }
}

async function handleTicketClose(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const parts = button.customId.split('_');
    const channelId = parts.length >= 3 ? parts[2] : button.channelId;

    const ticket = await Ticket.findOne({ channelId });

    if (!ticket) {
      const channel = button.channel as TextChannel;
      if (channel.name.startsWith('ticket-')) {
        const settings = await GuildSettings.findOne({ guildId: button.guildId });

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
          await button.editReply({ content: 'Are you sure you want to close this ticket?', components: [row] });
          return;
        }

        await button.editReply({ content: '🔒 The ticket will close in 5 seconds...' });
        setTimeout(async () => {
          try {
            await channel.delete();
          } catch (error) {
            reportError('buttonInteraction:closeTicket', error, { channelId: channel.id });
          }
        }, 5000);
        return;
      }
      await button.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    if (ticket.status === 'closed') {
      await button.editReply({ content: '❌ The ticket is already closed.' });
      return;
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = button.user.id;
    await ticket.save();

    const channel = button.channel as TextChannel;
    await channel.permissionOverwrites.edit(ticket.odId, {
      SendMessages: false
    });

    const closeEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket closed')
      .setDescription(`Ticket closed by <@${button.user.id}>`)
      .setColor(0xED4245)
      .setTimestamp();

    const closeButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_reopen_${channel.id}`)
          .setLabel('🔓 Reopen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_delete_${channel.id}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );

    await channel.send({ embeds: [closeEmbed], components: [closeButtons] });
    await button.editReply({ content: '✅ The ticket has been closed.' });
  } catch (error) {
    logger.error('Error closing ticket:', error);
    await button.editReply({ content: '❌ An error occurred.' });
  }
}

async function handleTicketClaim(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelId = button.customId.split('_')[2];
    const ticket = await Ticket.findOne({ channelId });

    if (!ticket) {
      await button.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    const member = await button.guild!.members.fetch(button.user.id);
    const settings = await GuildSettings.findOne({ guildId: button.guildId });
    const isSupport = (settings?.tickets?.supportRoles || []).some((r: string) => member.roles.cache.has(r));

    if (!isSupport && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await button.editReply({ content: '❌ Only support staff can claim tickets.' });
      return;
    }

    const claimed = await withRecordLock(`ticket-claim:${channelId}`, async () => {
      const fresh = await Ticket.findOne({ channelId });
      if (!fresh || fresh.claimedBy) return fresh?.claimedBy || null;
      fresh.claimedBy = button.user.id;
      fresh.status = 'claimed';
      await fresh.save();
      return null;
    });

    if (claimed) {
      await button.editReply({ content: `❌ Ticket already claimed by <@${claimed}>.` });
      return;
    }

    const claimEmbed = new EmbedBuilder()
      .setTitle('📋 Ticket claimed')
      .setDescription(`Ticket claimed by <@${button.user.id}>`)
      .setColor(0x57F287)
      .setTimestamp();

    await (button.channel as TextChannel).send({ embeds: [claimEmbed] });
    await button.editReply({ content: '✅ You have claimed the ticket.' });
  } catch (error) {
    logger.error('Error claiming ticket:', error);
    await button.editReply({ content: '❌ An error occurred.' });
  }
}

async function handleTicketDelete(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelId = button.customId.split('_')[2];
    const ticket = await Ticket.findOne({ channelId });

    if (!ticket) {
      await button.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    const member = await button.guild!.members.fetch(button.user.id);
    const settings = await GuildSettings.findOne({ guildId: button.guildId });
    const isSupport = (settings?.tickets?.supportRoles || []).some((r: string) => member.roles.cache.has(r));

    if (!isSupport && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await button.editReply({ content: '❌ You do not have permission to delete the ticket.' });
      return;
    }

    await button.editReply({ content: '🗑️ The ticket will be deleted in 5 seconds...' });

    setTimeout(async () => {
      try {
        await button.channel?.delete();
        await Ticket.deleteOne({ channelId });
      } catch (e) {
        logger.error('Error deleting ticket channel:', e);
      }
    }, 5000);
  } catch (error) {
    logger.error('Error deleting ticket:', error);
    await button.editReply({ content: '❌ An error occurred.' });
  }
}

async function handleTicketReopen(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelId = button.customId.split('_')[2];
    const ticket = await Ticket.findOne({ channelId });

    if (!ticket) {
      await button.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    const member = await button.guild!.members.fetch(button.user.id);
    const settings = await GuildSettings.findOne({ guildId: button.guildId });
    const isSupport = (settings?.tickets?.supportRoles || []).some((r: string) => member.roles.cache.has(r));

    if (!isSupport && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await button.editReply({ content: '❌ Only support staff can reopen tickets.' });
      return;
    }

    ticket.status = 'open';
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
    await ticket.save();

    const channel = button.channel as TextChannel;
    await channel.permissionOverwrites.edit(ticket.odId, {
      SendMessages: true
    });

    const reopenEmbed = new EmbedBuilder()
      .setTitle('🔓 Ticket reopened')
      .setDescription(`Ticket reopened by <@${button.user.id}>`)
      .setColor(0x57F287)
      .setTimestamp();

    await channel.send({ embeds: [reopenEmbed] });
    await button.editReply({ content: '✅ The ticket has been reopened.' });
  } catch (error) {
    logger.error('Error reopening ticket:', error);
    await button.editReply({ content: '❌ An error occurred.' });
  }
}

async function handleTicketTranscript(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channel = button.channel as TextChannel;

    if (!channel.name.startsWith('ticket-')) {
      await button.editReply({ content: '❌ This is not a ticket channel.' });
      return;
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = [...messages.values()].reverse();

    let transcript = `# Ticket Transcript: ${channel.name}\n`;
    transcript += `Generated: ${new Date().toISOString()}\n`;
    transcript += `Generated by: ${button.user.tag}\n\n`;
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

    await button.editReply({
      content: '📝 Ticket transcript:',
      files: [{ attachment: buffer, name: `transcript-${channel.name}.txt` }]
    });
  } catch (error) {
    logger.error('Error creating transcript:', error);
    await button.editReply({ content: '❌ An error occurred while creating the transcript.' });
  }
}

async function handleTicketCloseConfirm(button: ButtonInteraction) {
  try {
    const channel = button.channel as TextChannel;

    if (!channel.name.startsWith('ticket-')) {
      await button.update({ content: '❌ This is not a ticket channel.', components: [] });
      return;
    }

    const ticket = await Ticket.findOne({ channelId: channel.id });
    const settings = await GuildSettings.findOne({ guildId: button.guildId });

    if (settings?.tickets?.transcriptChannel) {
      const transcriptChannel = button.guild!.channels.cache.get(settings.tickets.transcriptChannel) as TextChannel;

      if (transcriptChannel) {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = [...messages.values()].reverse();

        let transcript = `# Ticket Transcript: ${channel.name}\n`;
        transcript += `Closed by: ${button.user.tag}\n`;
        transcript += `Generated: ${new Date().toISOString()}\n\n---\n\n`;

        for (const msg of sortedMessages) {
          transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[No text]'}\n`;
        }

        const buffer = Buffer.from(transcript, 'utf-8');

        await transcriptChannel.send({
          content: `📝 Transcript for **${channel.name}** (closed by ${button.user})`,
          files: [{ attachment: buffer, name: `transcript-${channel.name}.txt` }]
        });
      }
    }

    await button.update({ content: '🔒 The ticket will close in 5 seconds...', components: [] });

    if (ticket) {
      ticket.status = 'closed';
      ticket.closedAt = new Date();
      ticket.closedBy = button.user.id;
      await ticket.save();
    }

    setTimeout(async () => {
      try {
        await channel.delete();
        if (ticket) {
          await Ticket.deleteOne({ channelId: channel.id });
        }
      } catch (e) {
        logger.error('Error deleting ticket channel:', e);
      }
    }, 5000);
  } catch (error) {
    logger.error('Error confirming ticket close:', error);
    await button.update({ content: '❌ An error occurred.', components: [] });
  }
}

async function handleVerification(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const settings = await GuildSettings.findOne({ guildId: button.guildId });
    if (!settings?.verification?.enabled || !settings.verification.roleId) {
      await button.editReply({ content: '❌ Verification is not set up.' });
      return;
    }

    const member = await button.guild!.members.fetch(button.user.id);

    if (member.roles.cache.has(settings.verification.roleId)) {
      await button.editReply({ content: '✅ You are already verified!' });
      return;
    }

    await member.roles.add(settings.verification.roleId);
    await button.editReply({ content: '✅ You have been successfully verified!' });
  } catch (error) {
    logger.error('Error verifying:', error);
    await button.editReply({ content: '❌ An error occurred during verification.' });
  }
}

async function handleRoleMenuButton(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const roleId = button.customId.slice('role_'.length);
    if (!/^\d+$/.test(roleId)) {
      await button.editReply({ content: '❌ Invalid button.' });
      return;
    }

    const member = await button.guild!.members.fetch(button.user.id);
    const role = button.guild!.roles.cache.get(roleId);

    if (!role) {
      await button.editReply({ content: '❌ This role no longer exists.' });
      return;
    }

    const me = button.guild!.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await button.editReply({ content: '❌ I am missing the **Manage Roles** permission.' });
      return;
    }
    if (role.position >= me.roles.highest.position) {
      await button.editReply({ content: `❌ I cannot assign **${role.name}** - my own role must be placed **above** it in Server Settings → Roles.` });
      return;
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await button.editReply({ content: `✅ Role **${role.name}** removed!` });
    } else {
      const dangerous = getDangerousRolePermissions(role.permissions);
      if (dangerous.length > 0) {
        logger.warn(`[handleRoleMenuButton] Refusing to grant ${role.name} (${role.id}) - role has sensitive permissions.`);
        await button.editReply({ content: `❌ **${role.name}** has sensitive permissions and can no longer be self-assigned. Ask an admin to update this role menu.` });
        return;
      }
      await member.roles.add(roleId);
      await button.editReply({ content: `✅ Role **${role.name}** added!` });
    }
  } catch (error: any) {
    logger.error('Error handling role menu button:', error);
    if (error?.code === 50013) {
      await button.editReply({ content: '❌ I could not change the role - make sure my role is **above** it in the role list and I have **Manage Roles**.' });
    } else {
      await button.editReply({ content: '❌ An error occurred while changing the role.' });
    }
  }
}

async function handleReactionRole(button: ButtonInteraction) {
  await button.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const parts = button.customId.split('_');
    if (parts.length < 3) {
      await button.editReply({ content: '❌ Invalid button.' });
      return;
    }

    const roleId = parts[2];
    const singleChoice = parts[3] === 's';
    const member = await button.guild!.members.fetch(button.user.id);
    const role = button.guild!.roles.cache.get(roleId);

    if (!role) {
      await button.editReply({ content: '❌ This role no longer exists.' });
      return;
    }

    const me = button.guild!.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await button.editReply({ content: '❌ I am missing the **Manage Roles** permission.' });
      return;
    }
    if (role.position >= me.roles.highest.position) {
      await button.editReply({ content: `❌ I cannot assign **${role.name}** - my own role must be placed **above** it in Server Settings → Roles.` });
      return;
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await button.editReply({ content: `✅ Role **${role.name}** removed!` });
    } else {
      const dangerous = getDangerousRolePermissions(role.permissions);
      if (dangerous.length > 0) {
        logger.warn(`[handleReactionRole] Refusing to grant ${role.name} (${role.id}) - role has sensitive permissions.`);
        await button.editReply({ content: `❌ **${role.name}** has sensitive permissions and can no longer be self-assigned. Ask an admin to update this reaction role.` });
        return;
      }

      const removedNames: string[] = [];

      if (singleChoice) {
        const panelRoleIds = new Set<string>();
        for (const row of button.message.components) {
          for (const comp of (row as any).components || []) {
            const cid: string | undefined = comp?.customId ?? comp?.custom_id;
            if (cid && cid.startsWith('rr_')) {
              const p = cid.split('_');
              if (p.length >= 3 && p[2] !== roleId) panelRoleIds.add(p[2]);
            }
          }
        }

        for (const otherId of panelRoleIds) {
          if (!member.roles.cache.has(otherId)) continue;
          const otherRole = button.guild!.roles.cache.get(otherId);
          if (otherRole && otherRole.position >= me.roles.highest.position) continue;
          try {
            await member.roles.remove(otherId);
            if (otherRole) removedNames.push(otherRole.name);
          } catch (error) {
            reportError('reactionRole:singleRemove', error, { roleId: otherId, userId: member.id });
          }
        }
      }

      await member.roles.add(roleId);

      if (removedNames.length > 0) {
        await button.editReply({ content: `✅ Role **${role.name}** added! (removed: ${removedNames.map(n => `**${n}**`).join(', ')})` });
      } else {
        await button.editReply({ content: `✅ Role **${role.name}** added!` });
      }
    }
  } catch (error: any) {
    logger.error('Error handling reaction role:', error);
    if (error?.code === 50013) {
      await button.editReply({ content: '❌ I could not change the role - make sure my role is **above** it in the role list and I have **Manage Roles**.' });
    } else {
      await button.editReply({ content: '❌ An error occurred while changing the role.' });
    }
  }
}

export default event;
