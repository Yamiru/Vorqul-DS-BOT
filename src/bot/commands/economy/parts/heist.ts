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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  MessageFlags
} from 'discord.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { formatNumber, randomInt } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';
import { suppress } from '../../../../utils/suppress.js';
import { logger } from '../../../../utils/logger.js';

const JOIN_WINDOW_MS = 60_000;
const MIN_CREW = 2;
const MAX_CREW = 10;

const active = new Set<string>();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('heist')
    .setDescription('Zorganizuj spoločnú lúpež - čím viac ľudí, tým vyššia šanca')
    .addIntegerOption(opt => opt.setName('vklad')
      .setDescription('Koľko každý člen vsádza').setMinValue(50).setMaxValue(100000).setRequired(true)),

  category: 'economy',
  guildOnly: true,
  cooldown: 900,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const stake = interaction.options.getInteger('vklad', true);

    const settings = await GuildSettings.findOne({ guildId });
    const emoji = settings?.economy?.currencyEmoji || settings?.economy?.currency || '💰';

    if (active.has(guildId)) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Na serveri už jedna lúpež prebieha. Počkaj, kým skončí.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const leaderData = await UserData.findOne({ odId: interaction.user.id, guildId });
    if ((leaderData?.balance || 0) < stake) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`Na vklad ${emoji} **${formatNumber(stake)}** nemáš dosť hotovosti.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    active.add(guildId);

    const crew = new Map<string, string>([[interaction.user.id, interaction.user.username]]);

    const buildEmbed = (closed = false) => new EmbedBuilder()
      .setColor(closed ? 0x949ba4 : 0xfee75c)
      .setTitle('🏦 Lúpež sa pripravuje')
      .setDescription(
        `${interaction.user} zvoláva partiu.\n` +
        `**Vklad:** ${emoji} ${formatNumber(stake)} na osobu\n` +
        `**Potrebných ľudí:** aspoň ${MIN_CREW}\n\n` +
        `**Partia (${crew.size}/${MAX_CREW}):**\n${[...crew.values()].map(n => `• ${n}`).join('\n')}`
      )
      .setFooter({ text: closed ? 'Prihlasovanie skončilo' : 'Prihlasovanie beží 60 sekúnd' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('heist_join').setLabel('Idem do toho').setStyle(ButtonStyle.Success).setEmoji('💼')
    );

    await interaction.reply({ embeds: [buildEmbed()], components: [row] });
    const panel = (await interaction.fetchReply()) as Message;

    const collector = panel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: JOIN_WINDOW_MS
    });

    collector.on('collect', async (button) => {
      if (button.customId !== 'heist_join') return;

      if (crew.has(button.user.id)) {
        await button.reply({ content: 'Už si v partii.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (crew.size >= MAX_CREW) {
        await button.reply({ content: 'Partia je plná.', flags: MessageFlags.Ephemeral });
        return;
      }

      const data = await UserData.findOne({ odId: button.user.id, guildId });
      if ((data?.balance || 0) < stake) {
        await button.reply({ content: `Na vklad ${emoji} ${formatNumber(stake)} nemáš dosť hotovosti.`, flags: MessageFlags.Ephemeral });
        return;
      }

      crew.set(button.user.id, button.user.username);
      await button.update({ embeds: [buildEmbed()], components: [row] });
    });

    collector.on('end', async () => {
      active.delete(guildId);

      try {
        await panel.edit({ embeds: [buildEmbed(true)], components: [] }).catch(suppress('heist'));

        if (crew.size < MIN_CREW) {
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0xed4245)
              .setTitle('🏦 Lúpež odvolaná')
              .setDescription(`Prihlásilo sa len ${crew.size} ľudí, treba aspoň ${MIN_CREW}. Nikto nič nestratil.`)]
          });
          return;
        }

        const confirmed: string[] = [];
        for (const userId of crew.keys()) {
          const data = await UserData.findOne({ odId: userId, guildId });
          if ((data?.balance || 0) >= stake) confirmed.push(userId);
        }

        if (confirmed.length < MIN_CREW) {
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0xed4245)
              .setTitle('🏦 Lúpež odvolaná')
              .setDescription('Časť partie medzitým prišla o peniaze. Nikto nič nestratil.')]
          });
          return;
        }

        for (const userId of confirmed) {
          await UserData.findOneAndUpdate({ odId: userId, guildId }, { $inc: { balance: -stake } }, { upsert: true });
        }

        const chance = Math.min(0.8, 0.3 + confirmed.length * 0.06);
        const success = Math.random() < chance;
        const pot = stake * confirmed.length;

        if (!success) {
          await interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🚨 Lúpež zlyhala')
              .setDescription(
                `Ochranka bola rýchlejšia. Partia prišla o celý vklad ${emoji} **${formatNumber(pot)}**.\n\n` +
                `Šanca na úspech bola ${Math.round(chance * 100)} %.`
              )]
          });
          return;
        }

        const multiplier = randomInt(15, 30) / 10;
        const payout = Math.floor((pot * multiplier) / confirmed.length);

        for (const userId of confirmed) {
          await UserData.findOneAndUpdate({ odId: userId, guildId }, { $inc: { balance: payout } }, { upsert: true });
        }

        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('💰 Lúpež vyšla')
            .setDescription(
              `Partia (${confirmed.length}) si rozdelila ${emoji} **${formatNumber(payout * confirmed.length)}**.\n` +
              `Na každého vyšlo ${emoji} **${formatNumber(payout)}** (vklad bol ${formatNumber(stake)}).\n\n` +
              `Šanca na úspech bola ${Math.round(chance * 100)} %.`
            )
            .addFields({ name: 'Partia', value: confirmed.map(id => `<@${id}>`).join(', ') })]
        });
      } catch (error) {
        logger.error('Heist resolution error:', error);
      }
    });
  }
};

export default command;
