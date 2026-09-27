/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';

const priceCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols') || 'BTC,ETH';
    const currency = searchParams.get('currency') || 'USD';

    const cacheKey = `${symbols}-${currency}`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const symbolList = symbols.split(',').map(s => s.trim().toLowerCase());

    const symbolToId: Record<string, string> = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'sol': 'solana',
      'xrp': 'ripple',
      'doge': 'dogecoin',
      'ada': 'cardano',
      'dot': 'polkadot',
      'matic': 'matic-network',
      'link': 'chainlink',
      'avax': 'avalanche-2',
      'uni': 'uniswap',
      'atom': 'cosmos',
      'ltc': 'litecoin',
      'shib': 'shiba-inu',
      'bnb': 'binancecoin',
    };

    const ids = symbolList.map(s => symbolToId[s] || s).join(',');

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency.toLowerCase()}&include_24hr_change=true&include_market_cap=true`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch crypto prices');
    }

    const data = await response.json();

    const prices: Record<string, any> = {};

    for (const symbol of symbolList) {
      const id = symbolToId[symbol] || symbol;
      const coinData = data[id];

      if (coinData) {
        const price = coinData[currency.toLowerCase()];
        const change24h = coinData[`${currency.toLowerCase()}_24h_change`];
        const marketCap = coinData[`${currency.toLowerCase()}_market_cap`];

        prices[symbol.toUpperCase()] = {
          price,
          change24h: change24h ? parseFloat(change24h.toFixed(2)) : 0,
          marketCap,
          currency: currency.toUpperCase(),
          formatted: formatPrice(price, currency)
        };
      }
    }

    const result = {
      prices,
      currency: currency.toUpperCase(),
      updatedAt: new Date().toISOString()
    };

    priceCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return NextResponse.json({ error: 'Failed to fetch crypto prices' }, { status: 500 });
  }
}

function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CZK': 'Kč'
  };

  const symbol = symbols[currency] || currency;

  if (price >= 1000) {
    return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `${symbol}${price.toFixed(2)}`;
  } else {
    return `${symbol}${price.toFixed(6)}`;
  }
}
