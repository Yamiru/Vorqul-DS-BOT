/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings, Giveaway } from '../../../utils/models.js';
import { resolveGiveaways } from '../../../shared/featureConfig.js';
import { parseTime, discordTimestamp } from '../../../utils/helpers.js';
import { i18n } from '../../../utils/i18n.js';
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption(opt =>
          opt.setName('prize').setDescription('What you\'re giving away').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration').setDescription('Duration (e.g., 1h, 1d, 7d)').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName('required_role').setDescription('Role required to enter').setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to host giveaway').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll giveaway winners')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('count').setDescription('Number of new winners').setMinValue(1).setMaxValue(20).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List active giveaways')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'fun',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    const settings = await GuildSettings.findOne({ guildId });
    const config = resolveGiveaways(settings);

    if (config.managerRole) {
      const member: any = interaction.member;
      const isManager = member?.roles?.cache?.has(config.managerRole)
        || member?.permissions?.has(PermissionFlagsBits.ManageGuild);

      if (!isManager) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', 'You do not have permission to manage giveaways.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    switch (subcommand) {
      case 'start': {
        const prize = interaction.options.getString('prize', true);
        const durationStr = interaction.options.getString('duration', true);
        const winnersCount = interaction.options.getInteger('winners') || 1;
        const requiredRoleOption = interaction.options.getRole('required_role');
        const requiredRoleId = requiredRoleOption?.id || config.requireRole || '';
        const requiredRoleMention = requiredRoleId ? `<@&${requiredRoleId}>` : '';

        const defaultChannel = config.channel
          ? (interaction.guild?.channels.cache.get(config.channel) as TextChannel | undefined)
          : undefined;
        const targetChannel = (interaction.options.getChannel('channel')
          || defaultChannel
          || interaction.channel) as TextChannel;

        const duration = parseTime(durationStr);
        if (!duration) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Invalid duration format.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const endsAt = new Date(Date.now() + duration);

        const embed = new EmbedBuilder()
          .setTitle(i18n.t('giveaway.title', guildId))
          .setDescription(
            `**Prize:** ${prize}\n\n` +
            `**Winners:** ${winnersCount}\n` +
            `**Ends:** ${discordTimestamp.relative(endsAt)}\n` +
            `**Hosted by:** ${interaction.user}\n` +
            (requiredRoleMention ? `**Required Role:** ${requiredRoleMention}\n` : '') +
            `\nClick ${config.emoji} to enter!`
          )
          .setColor(config.color as `#${string}`)
          .setFooter({ text: `${winnersCount} winner(s)` })
          .setTimestamp(endsAt);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_enter')
            .setLabel('Enter Giveaway')
            .setEmoji(config.emoji)
            .setStyle(ButtonStyle.Primary)
        );

        const message = await targetChannel.send({
          embeds: [embed],
          components: [row]
        });

        await Giveaway.create({
          guildId,
          channelId: targetChannel.id,
          messageId: message.id,
          prize,
          winnersCount,
          endsAt,
          hostId: interaction.user.id,
          requiredRole: requiredRoleId || undefined,
          participants: [],
          ended: false
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Giveaway Started!',
              `Prize: **${prize}**\nEnds: ${discordTimestamp.relative(endsAt)}\nChannel: ${targetChannel}`
            )
          ],
          flags: MessageFlags.Ephemeral
        });
        break;
      }

      case 'end': {
        const messageId = interaction.options.getString('message_id', true);
        const giveaway = await Giveaway.findOne({ guildId, messageId, ended: false });

        if (!giveaway) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Giveaway not found or already ended.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await endGiveaway(interaction.client, giveaway);

        await interaction.reply({
          embeds: [EmbedHelper.success('Ended', 'Giveaway has been ended.')],
          flags: MessageFlags.Ephemeral
        });
        break;
      }

      case 'reroll': {
        const messageId = interaction.options.getString('message_id', true);
        const count = interaction.options.getInteger('count') || 1;

        const giveaway = await Giveaway.findOne({ guildId, messageId, ended: true });

        if (!giveaway) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Ended giveaway not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const winners = selectWinners(giveaway.participants, count, giveaway.winners);

        if (winners.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'No valid participants to reroll.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const channel = interaction.guild!.channels.cache.get(giveaway.channelId) as TextChannel;
        if (channel) {
          await channel.send({
            content: i18n.t('giveaway.rerolled', guildId, {
              winners: winners.map(w => `<@${w}>`).join(', '),
              prize: giveaway.prize
            })
          });
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Rerolled', `New winners: ${winners.map(w => `<@${w}>`).join(', ')}`)]
        });
        break;
      }

      case 'list': {
        const giveaways = await Giveaway.find({ guildId, ended: false });

        if (giveaways.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Giveaways', 'No active giveaways.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(i18n.t('giveaway.activeTitle', guildId))
          .setColor('#FF69B4')
          .setDescription(
            giveaways.map((g, i) =>
              `**${i + 1}.** ${g.prize}\n` +
              `   Channel: <#${g.channelId}>\n` +
              `   Ends: ${discordTimestamp.relative(g.endsAt)}\n` +
              `   Participants: ${g.participants.length}`
            ).join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  }
};

async function endGiveaway(client: any, giveaway: any): Promise<void> {
  const winners = selectWinners(giveaway.participants || [], giveaway.winnersCount || giveaway.winners_count || 1);
  const endGuildId = giveaway.guildId || giveaway.guild_id;
  const endConfig = resolveGiveaways(endGuildId ? await GuildSettings.findOne({ guildId: endGuildId }) : null);

  await Giveaway.findOneAndUpdate(
    { messageId: giveaway.messageId || giveaway.message_id },
    { $set: { ended: true, winners } }
  );

  const channel = client.channels.cache.get(giveaway.channelId || giveaway.channel_id) as TextChannel;
  if (!channel) return;

  const guildId = giveaway.guildId || giveaway.guild_id || channel.guildId;

  try {
    const message = await channel.messages.fetch(giveaway.messageId || giveaway.message_id);

    const embed = new EmbedBuilder()
      .setTitle(i18n.t('giveaway.endedTitle', guildId))
      .setDescription(
        `**Prize:** ${giveaway.prize}\n\n` +
        `**Winner(s):** ${winners.length > 0 ? winners.map((w: string) => `<@${w}>`).join(', ') : 'No valid participants'}\n` +
        `**Hosted by:** <@${giveaway.hostId || giveaway.host_id}>`
      )
      .setColor('#808080')
      .setFooter({ text: `${(giveaway.participants || []).length} participants` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_ended')
        .setLabel('Giveaway Ended')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await message.edit({ embeds: [embed], components: [row] });

    if (winners.length > 0) {
      await channel.send({
        content: i18n.t('giveaway.won', guildId, {
          winners: winners.map((w: string) => `<@${w}>`).join(', '),
          prize: giveaway.prize
        })
      });

      if (endConfig.dmWinners) {
        for (const winnerId of winners) {
          try {
            const user = await client.users.fetch(winnerId);
            await user.send(
              `🎉 Vyhral si v súťaži o **${giveaway.prize}** na serveri ${channel.guild?.name || ''}!`
            );
          } catch (error) {
              logger.debug('giveaway: suppressed error', error);
            }
        }
      }
    }
  } catch (error) {
      logger.debug('giveaway: suppressed error', error);
    }
}

function selectWinners(participants: string[], count: number, exclude: string[] = []): string[] {
  const eligible = participants.filter(p => !exclude.includes(p));
  const winners: string[] = [];

  for (let i = 0; i < Math.min(count, eligible.length); i++) {
    const index = Math.floor(Math.random() * eligible.length);
    winners.push(eligible.splice(index, 1)[0]);
  }

  return winners;
}

export { endGiveaway };
export default command;
