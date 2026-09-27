/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { resolveEconomy } from '../../../../shared/featureConfig.js';
import { formatNumber, randomInt } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';

const MIN_TARGET_CASH = 100;
const MIN_OWN_CASH = 50;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Skús okradnúť iného hráča o hotovosť')
    .addUserOption(opt => opt.setName('user')
      .setDescription('Koho chceš okradnúť').setRequired(true)),

  category: 'economy',
  guildOnly: true,
  cooldown: 600,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const robber = interaction.user;
    const target = interaction.options.getUser('user', true);

    const settings = await GuildSettings.findOne({ guildId });
    const emoji = settings?.economy?.currencyEmoji || settings?.economy?.currency || '💰';

    if (!resolveEconomy(settings).robEnabled) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Okrádanie je na tomto serveri vypnuté.')]
      });
      return;
    }

    if (target.id === robber.id) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Sám seba okradnúť nemôžeš.')]
      });
      return;
    }

    if (target.bot) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Boti pri sebe peniaze nenosia.')]
      });
      return;
    }

    const robberData = await UserData.findOne({ odId: robber.id, guildId });
    const targetData = await UserData.findOne({ odId: target.id, guildId });

    const robberCash = robberData?.balance || 0;
    const targetCash = targetData?.balance || 0;

    if (robberCash < MIN_OWN_CASH) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`Potrebuješ aspoň ${emoji} **${MIN_OWN_CASH}** - je z čoho zaplatiť pokutu, keď ťa chytia.`)]
      });
      return;
    }

    if (targetCash < MIN_TARGET_CASH) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`${target.username} má pri sebe príliš málo. Skús niekoho bohatšieho.`)]
      });
      return;
    }

    const successChance = Math.min(0.6, 0.25 + targetCash / 20000);
    const success = Math.random() < successChance;

    if (success) {
      const stolen = randomInt(Math.floor(targetCash * 0.1), Math.floor(targetCash * 0.35));

      await UserData.findOneAndUpdate({ odId: robber.id, guildId }, { $inc: { balance: stolen } }, { upsert: true });
      await UserData.findOneAndUpdate({ odId: target.id, guildId }, { $inc: { balance: -stolen } }, { upsert: true });

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🕵️ Lup sa podaril')
          .setDescription(`Okradol si ${target} o ${emoji} **${formatNumber(stolen)}**.`)
          .setFooter({ text: `Šanca na úspech bola ${Math.round(successChance * 100)} %` })]
      });
      return;
    }

    const fine = Math.min(robberCash, randomInt(Math.floor(robberCash * 0.1), Math.floor(robberCash * 0.3)));
    await UserData.findOneAndUpdate({ odId: robber.id, guildId }, { $inc: { balance: -fine } }, { upsert: true });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🚔 Chytili ťa')
        .setDescription(`Pokus o okradnutie ${target} nevyšiel. Pokuta: ${emoji} **${formatNumber(fine)}**.`)
        .setFooter({ text: `Šanca na úspech bola ${Math.round(successChance * 100)} %` })]
    });
  }
};

export default command;
