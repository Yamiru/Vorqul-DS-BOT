/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { resolveEconomy } from '../../../../shared/featureConfig.js';
import { formatNumber } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

function parseAmount(input: string, available: number): number | null {
  const value = input.trim().toLowerCase();
  if (['all', 'vsetko', 'všetko', 'max'].includes(value)) return available;
  if (['half', 'polovica', 'pol'].includes(value)) return Math.floor(available / 2);

  const parsed = parseInt(value.replace(/[\s_,]/g, ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Ulož si peniaze do banky, kde ti ich nikto neukradne')
    .addSubcommand(sub =>
      sub.setName('balance').setDescription('Zostatok v hotovosti a v banke'))
    .addSubcommand(sub =>
      sub.setName('deposit').setDescription('Vlož peniaze do banky')
        .addStringOption(opt => opt.setName('suma')
          .setDescription('Číslo alebo "all"').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('withdraw').setDescription('Vyber peniaze z banky')
        .addStringOption(opt => opt.setName('suma')
          .setDescription('Číslo alebo "all"').setRequired(true))),

  category: 'economy',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    const settings = await GuildSettings.findOne({ guildId });
    const economy = resolveEconomy(settings);
    const emoji = economy.currencyEmoji;

    if (!economy.bankEnabled) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Banka je na tomto serveri vypnutá.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    let userData = await UserData.findOne({ odId: userId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId: userId, guildId, bank: 0 });
    }

    const cash = userData.balance || 0;
    let bank = userData.bank || 0;

    if (economy.bankInterest > 0 && bank > 0) {
      const lastPaid = userData.lastBankInterest ? new Date(userData.lastBankInterest).getTime() : 0;
      const days = lastPaid ? Math.floor((Date.now() - lastPaid) / 86400000) : 1;

      if (days > 0) {
        const gained = Math.floor(bank * (economy.bankInterest / 100) * Math.min(days, 30));
        if (gained > 0) {
          bank += gained;
          await UserData.findOneAndUpdate(
            { odId: userId, guildId },
            { $set: { bank, lastBankInterest: new Date().toISOString() } }
          );
        }
      }
    }

    if (sub === 'balance') {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${emoji} Účet používateľa ${interaction.user.username}`)
          .addFields(
            { name: 'Hotovosť', value: `${emoji} ${formatNumber(cash)}`, inline: true },
            { name: 'Banka', value: `${emoji} ${formatNumber(bank)}`, inline: true },
            { name: 'Spolu', value: `${emoji} ${formatNumber(cash + bank)}`, inline: true }
          )
          .setFooter({ text: 'Peniaze v banke sa nedajú ukradnúť.' })]
      });
      return;
    }

    const raw = interaction.options.getString('suma', true);
    const isDeposit = sub === 'deposit';
    const available = isDeposit ? cash : bank;
    const amount = parseAmount(raw, available);

    if (amount === null) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Zadaj kladné číslo alebo `all`.')]
      });
      return;
    }

    if (available <= 0) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(isDeposit ? 'Nemáš žiadnu hotovosť.' : 'V banke nemáš nič.')]
      });
      return;
    }

    if (amount > available) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`Toľko nemáš. K dispozícii: ${emoji} **${formatNumber(available)}**.`)]
      });
      return;
    }

    const db = getDatabase();
    const sourceColumn = isDeposit ? 'balance' : 'bank';
    const destColumn = isDeposit ? 'bank' : 'balance';

    const debited = await db.decrementIfAtLeast('user_data', sourceColumn, amount, {
      user_id: userId,
      guild_id: guildId
    });

    if (!debited) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Zostatok sa medzičasom zmenil, skús to znova.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await db.increment('user_data', { [destColumn]: amount }, {
      user_id: userId,
      guild_id: guildId
    });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57f287)
        .setDescription(
          isDeposit
            ? `${emoji} **${formatNumber(amount)}** si uložil do banky.`
            : `${emoji} **${formatNumber(amount)}** si vybral z banky.`
        )
        .addFields(
          { name: 'Hotovosť', value: `${emoji} ${formatNumber(isDeposit ? cash - amount : cash + amount)}`, inline: true },
          { name: 'Banka', value: `${emoji} ${formatNumber(isDeposit ? bank + amount : bank - amount)}`, inline: true }
        )]
    });
  }
};

export default command;
