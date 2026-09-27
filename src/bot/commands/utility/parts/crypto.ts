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
  AutocompleteInteraction,
  EmbedBuilder
} from 'discord.js';
import axios from 'axios';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { i18n } from '../../../../utils/i18n.js';
import { formatCurrency, formatPercentage } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const popularCoins = [
  { name: 'Bitcoin', id: 'bitcoin' },
  { name: 'Ethereum', id: 'ethereum' },
  { name: 'Dogecoin', id: 'dogecoin' },
  { name: 'Solana', id: 'solana' },
  { name: 'Cardano', id: 'cardano' },
  { name: 'Ripple', id: 'ripple' },
  { name: 'Polkadot', id: 'polkadot' },
  { name: 'Litecoin', id: 'litecoin' },
  { name: 'Chainlink', id: 'chainlink' },
  { name: 'Polygon', id: 'matic-network' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Get cryptocurrency prices')
    .addStringOption(option =>
      option
        .setName('coin')
        .setDescription('Cryptocurrency to check (e.g., bitcoin, ethereum)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  category: 'utility',
  cooldown: 10,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId || 'dm';
    const coinId = interaction.options.getString('coin') || 'bitcoin';

    await interaction.deferReply();

    try {
      const response = await axios.get(`${COINGECKO_API}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: coinId,
          order: 'market_cap_desc',
          sparkline: false,
          price_change_percentage: '24h,7d'
        },
        timeout: 10000
      });

      if (!response.data || response.data.length === 0) {
        await interaction.editReply({
          embeds: [EmbedHelper.error('Error', i18n.t('crypto.invalidCoin', guildId))]
        });
        return;
      }

      const coin = response.data[0];
      const change24h = coin.price_change_percentage_24h || 0;
      const changeColor = change24h >= 0 ? '#57F287' : '#ED4245';
      const changeEmoji = change24h >= 0 ? '📈' : '📉';

      const embed = new EmbedBuilder()
        .setTitle(`${coin.name} (${coin.symbol.toUpperCase()})`)
        .setThumbnail(coin.image)
        .setColor(changeColor as `#${string}`)
        .addFields(
          { name: '💵 Price', value: formatCurrency(coin.current_price), inline: true },
          { name: `${changeEmoji} 24h Change`, value: formatPercentage(change24h), inline: true },
          { name: '📊 Market Cap', value: formatCurrency(coin.market_cap), inline: true },
          { name: '📈 24h High', value: formatCurrency(coin.high_24h), inline: true },
          { name: '📉 24h Low', value: formatCurrency(coin.low_24h), inline: true },
          { name: '💹 Volume', value: formatCurrency(coin.total_volume), inline: true }
        )
        .setFooter({ text: 'Data from CoinGecko' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', i18n.t('crypto.apiError', guildId))]
      });
    }
  },

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused().toLowerCase();

    const filtered = popularCoins
      .filter(coin =>
        coin.name.toLowerCase().includes(focused) ||
        coin.id.toLowerCase().includes(focused)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(coin => ({ name: coin.name, value: coin.id }))
    );
  }
};

export default command;
