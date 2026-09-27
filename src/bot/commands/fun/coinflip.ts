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
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { GuildSettings, UserData } from '../../../utils/models.js';
import { gameAllowed, resolveEconomy } from '../../../shared/featureConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin')
    .addStringOption(opt =>
      opt.setName('volba')
        .setDescription('Your choice')
        .addChoices(
          { name: 'Hlava', value: 'heads' },
          { name: 'Orol', value: 'tails' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('stazka')
        .setDescription('Bet (coins)')
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const choice = interaction.options.getString('volba');
    const bet = interaction.options.getInteger('stazka');
    const db = getDatabase();

    const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
    const economy = resolveEconomy(settings);
    const currencyEmoji = economy.currencyEmoji;

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const resultText = result === 'heads' ? '👑 Hlava' : '🦅 Orol';

    if (!bet) {
      const embed = new EmbedBuilder()
        .setTitle('🪙 Coinflip')
        .setDescription(`Minca padla na: **${resultText}**`)
        .setColor(0xFFD700);

      if (choice) {
        const won = choice === result;
        embed.addFields({
          name: won ? '🎉 Vyhral si!' : '😢 Prehral si!',
          value: `Tipoval si: ${choice === 'heads' ? '👑 Hlava' : '🦅 Orol'}`
        });
        embed.setColor(won ? 0x00FF00 : 0xFF0000);
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (!gameAllowed(economy, 'coinflip')) {
      return interaction.reply({
        content: '❌ Coinflip betting is disabled on this server.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (bet < economy.minBet || bet > economy.maxBet) {
      return interaction.reply({
        content: `❌ Bet must be between ${economy.minBet} and ${economy.maxBet}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (!choice) {
      return interaction.reply({
        content: '❌ You must choose heads or tails for the bet!',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    let userData = await UserData.findOne({ odId: userId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId: userId, guildId });
    }
    const balance = userData.balance || 0;

    if (balance < bet) {
      return interaction.reply({
        content: `❌ You do not have enough coins! You have: ${currencyEmoji} ${balance}`,
        flags: MessageFlags.Ephemeral
      });
    }

    const debited = await db.decrementIfAtLeast('user_data', 'balance', bet, {
      user_id: userId,
      guild_id: guildId
    });

    if (!debited) {
      return interaction.reply({
        content: '❌ Your balance changed and is no longer enough for this bet.',
        flags: MessageFlags.Ephemeral
      });
    }

    const won = choice === result;
    const winnings = won ? bet : -bet;

    if (won) {
      await db.increment('user_data', { balance: bet * 2 }, { user_id: userId, guild_id: guildId });
    }

    const newBalance = balance - bet + (won ? bet * 2 : 0);

    const embed = new EmbedBuilder()
      .setTitle('🪙 Coinflip - Gambling')
      .setDescription(`Minca padla na: **${resultText}**`)
      .addFields(
        { name: 'Your choice', value: choice === 'heads' ? '👑 Hlava' : '🦅 Orol', inline: true },
        { name: 'Bet', value: `${currencyEmoji} ${bet}`, inline: true },
        {
          name: won ? '🎉 Win!' : '💸 Prehra',
          value: `${won ? '+' : ''}${currencyEmoji} ${winnings}`,
          inline: true
        },
        { name: 'New balance', value: `${currencyEmoji} ${newBalance}` }
      )
      .setColor(won ? 0x00FF00 : 0xFF0000);

    await interaction.reply({ embeds: [embed] });
  }
};
