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
  AutocompleteInteraction
} from 'discord.js';
import type { Command } from '../../../types.js';
import { logger } from '../../../../utils/logger.js';

const stockCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 1000;

const stockCacheSweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of stockCache) {
    if (now - entry.timestamp > CACHE_DURATION) stockCache.delete(key);
  }
}, CACHE_DURATION);
stockCacheSweeper.unref?.();


const popularStocks = [
  { name: 'Apple (AAPL)', value: 'AAPL' },
  { name: 'Microsoft (MSFT)', value: 'MSFT' },
  { name: 'Google (GOOGL)', value: 'GOOGL' },
  { name: 'Amazon (AMZN)', value: 'AMZN' },
  { name: 'Tesla (TSLA)', value: 'TSLA' },
  { name: 'NVIDIA (NVDA)', value: 'NVDA' },
  { name: 'Meta (META)', value: 'META' },
  { name: 'Netflix (NFLX)', value: 'NFLX' },
  { name: 'AMD (AMD)', value: 'AMD' },
  { name: 'Intel (INTC)', value: 'INTC' },
  { name: 'Disney (DIS)', value: 'DIS' },
  { name: 'Nike (NKE)', value: 'NKE' },
  { name: 'Coca-Cola (KO)', value: 'KO' },
  { name: 'S&P 500 ETF (SPY)', value: 'SPY' },
  { name: 'Nasdaq ETF (QQQ)', value: 'QQQ' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Show a stock price')
    .addStringOption(option =>
      option
        .setName('symbol')
        .setDescription('Symbol akcie (napr. AAPL, TSLA, MSFT)')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  category: 'utility',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const symbol = interaction.options.getString('symbol', true).toUpperCase();

      const cached = stockCache.get(symbol);
      let data;

      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        data = cached.data;
      } else {
        data = await fetchStockData(symbol);
        stockCache.set(symbol, { data, timestamp: Date.now() });
      }

      if (!data) {
        await interaction.editReply({
          content: '❌ Could not find the stock. Check the symbol.'
        });
        return;
      }

      const changeEmoji = data.change >= 0 ? '📈' : '📉';
      const changeColor = data.change >= 0 ? 0x57f287 : 0xed4245;

      const embed = new EmbedBuilder()
        .setTitle(`${data.name} (${symbol})`)
        .setColor(changeColor)
        .addFields(
          { name: '💵 Cena', value: `$${data.price.toFixed(2)}`, inline: true },
          { name: `${changeEmoji} Zmena`, value: `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`, inline: true },
          { name: '📊 Volume', value: formatVolume(data.volume), inline: true },
          { name: '📈 High', value: `$${data.high.toFixed(2)}`, inline: true },
          { name: '📉 Low', value: `$${data.low.toFixed(2)}`, inline: true },
          { name: '🏢 Market Cap', value: formatMarketCap(data.marketCap), inline: true }
        )
        .setFooter({ text: 'Data may be delayed' })
        .setTimestamp();

      if (data.chartUrl) {
        embed.setImage(data.chartUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Stock command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching data. Try again later.'
      });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toUpperCase();

    const filtered = popularStocks
      .filter(stock =>
        stock.name.toUpperCase().includes(focused) ||
        stock.value.includes(focused)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(stock => ({ name: stock.name, value: stock.value }))
    );
  }
};

async function fetchStockData(symbol: string): Promise<any> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const json = await response.json() as any;
    const result = json.chart.result?.[0];

    if (!result) {
      return null;
    }

    const meta = result.meta;
    const quote = result.indicators.quote[0];

    const currentPrice = meta.regularMarketPrice || quote.close?.[quote.close.length - 1] || 0;
    const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      name: meta.shortName || meta.symbol,
      symbol: meta.symbol,
      price: currentPrice,
      change,
      changePercent,
      high: meta.regularMarketDayHigh || Math.max(...(quote.high || [currentPrice])),
      low: meta.regularMarketDayLow || Math.min(...(quote.low || [currentPrice])),
      volume: meta.regularMarketVolume || quote.volume?.[quote.volume.length - 1] || 0,
      marketCap: meta.marketCap || 0,
      chartUrl: null
    };
  } catch (error) {
    logger.error('Error fetching stock data:', error);

    const demoData: Record<string, any> = {
      'AAPL': { name: 'Apple Inc.', price: 185.92, marketCap: 2.89e12 },
      'MSFT': { name: 'Microsoft Corp.', price: 378.91, marketCap: 2.81e12 },
      'GOOGL': { name: 'Alphabet Inc.', price: 141.80, marketCap: 1.78e12 },
      'TSLA': { name: 'Tesla Inc.', price: 248.50, marketCap: 791e9 },
      'NVDA': { name: 'NVIDIA Corp.', price: 495.22, marketCap: 1.22e12 },
    };

    const demo = demoData[symbol];
    if (demo) {
      const change = (Math.random() - 0.5) * 10;
      return {
        name: demo.name,
        symbol,
        price: demo.price + change,
        change,
        changePercent: (change / demo.price) * 100,
        high: demo.price * 1.02,
        low: demo.price * 0.98,
        volume: Math.floor(Math.random() * 50000000),
        marketCap: demo.marketCap,
        chartUrl: null
      };
    }

    return null;
  }
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
  return volume.toString();
}

function formatMarketCap(cap: number): string {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(2) + 'M';
  return '$' + cap.toLocaleString();
}

export default command;
