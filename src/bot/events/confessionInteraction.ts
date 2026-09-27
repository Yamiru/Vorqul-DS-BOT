/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Client,
  Events,
  Interaction,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { getDatabase } from '../../utils/database.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import type { Event } from '../types.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

interface ConfessionRow { guild_id: string; number: number; user_id: string; content: string; message_id?: string; }

async function nextNumber(guildId: string): Promise<number> {
  const db = getDatabase();
  const rows = await db.find<ConfessionRow>('confessions', { guild_id: guildId });
  let max = 0;
  for (const r of rows) if (typeof r.number === 'number' && r.number > max) max = r.number;
  return db.nextCounterValue('confession', guildId, max);
}

async function fetchTextChannel(client: Client, id?: string): Promise<TextChannel | null> {
  if (!id) return null;
  const ch = await client.channels.fetch(id).catch(() => null);
  return ch && (ch as TextChannel).send ? (ch as TextChannel) : null;
}

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  execute: async (client: Client, interaction: Interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('confess_reply_')) {
        const num = interaction.customId.slice('confess_reply_'.length);
        const modal = new ModalBuilder().setCustomId(`confess_replymodal_${num}`).setTitle(`Reply to confession #${num}`);
        const input = new TextInputBuilder()
          .setCustomId('reply_text')
          .setLabel('Your anonymous reply')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      if (!interaction.isModalSubmit() || !interaction.guildId) return;

      const guildId = interaction.guildId;
      const settings = await GuildSettings.findOne({ guildId });
      const cfg: any = (settings as any)?.confessions;

      if (interaction.customId === 'confess_modal') {
        if (!cfg || cfg.enabled !== true || !cfg.channel) {
          await interaction.reply({ embeds: [EmbedHelper.error('Confessions are off', 'Confessions are not configured.')], flags: MessageFlags.Ephemeral });
          return;
        }
        const content = interaction.fields.getTextInputValue('confess_text');
        const channel = await fetchTextChannel(client, cfg.channel);
        if (!channel) {
          await interaction.reply({ embeds: [EmbedHelper.error('Error', 'The confession channel could not be found.')], flags: MessageFlags.Ephemeral });
          return;
        }

        const number = await nextNumber(guildId);
        const embed = new EmbedBuilder()
          .setTitle(`Anonymous confession #${number}`)
          .setDescription(content)
          .setColor(0x5865f2)
          .setTimestamp()
          .setFooter({ text: 'Sent anonymously via /confess' });

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        if (cfg.allowReplies) {
          components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`confess_reply_${number}`).setLabel('Reply anonymously').setStyle(ButtonStyle.Secondary).setEmoji('💬')
          ));
        }

        const sent = await channel.send({ embeds: [embed], components });

        const db = getDatabase();
        await db.insert('confessions', { guild_id: guildId, number, user_id: interaction.user.id, content, message_id: sent.id });

        if (cfg.logChannel) {
          const log = await fetchTextChannel(client, cfg.logChannel);
          if (log) {
            await log.send({ embeds: [new EmbedBuilder()
              .setTitle(`Confession #${number} - staff log`)
              .setDescription(content)
              .addFields({ name: 'Author', value: `<@${interaction.user.id}> (${interaction.user.tag})` })
              .setColor(0xfaa61a)
              .setTimestamp()] }).catch(suppress('confessionInteraction'));
          }
        }

        await interaction.reply({ embeds: [EmbedHelper.success('Confession sent', `Posted anonymously as #${number}.`)], flags: MessageFlags.Ephemeral });
        return;
      }

      if (interaction.customId.startsWith('confess_replymodal_')) {
        if (!cfg || cfg.enabled !== true || !cfg.allowReplies || !cfg.channel) {
          await interaction.reply({ embeds: [EmbedHelper.error('Replies are off', 'Anonymous replies are not enabled.')], flags: MessageFlags.Ephemeral });
          return;
        }
        const num = interaction.customId.slice('confess_replymodal_'.length);
        const reply = interaction.fields.getTextInputValue('reply_text');
        const channel = await fetchTextChannel(client, cfg.channel);
        if (!channel) {
          await interaction.reply({ embeds: [EmbedHelper.error('Error', 'The confession channel could not be found.')], flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`Anonymous reply to #${num}`)
          .setDescription(reply)
          .setColor(0x949ba4)
          .setTimestamp();
        await channel.send({ embeds: [embed] });

        if (cfg.logChannel) {
          const log = await fetchTextChannel(client, cfg.logChannel);
          if (log) {
            await log.send({ embeds: [new EmbedBuilder()
              .setTitle(`Reply to #${num} - staff log`)
              .setDescription(reply)
              .addFields({ name: 'Author', value: `<@${interaction.user.id}> (${interaction.user.tag})` })
              .setColor(0xfaa61a)
              .setTimestamp()] }).catch(suppress('confessionInteraction'));
          }
        }

        await interaction.reply({ embeds: [EmbedHelper.success('Reply sent', 'Your anonymous reply was posted.')], flags: MessageFlags.Ephemeral });
        return;
      }
    } catch (err) {
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [EmbedHelper.error('Error', 'Something went wrong handling that.')], flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
          logger.debug('confessionInteraction: suppressed error', error);
        }
    }
  }
};

export default event;
