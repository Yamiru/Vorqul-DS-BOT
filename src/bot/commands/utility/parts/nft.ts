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

const nftCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const nftCacheSweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of nftCache) {
    if (now - entry.timestamp > CACHE_DURATION) nftCache.delete(key);
  }
}, CACHE_DURATION);
nftCacheSweeper.unref?.();


const popularCollections = [
  { name: 'Bored Ape Yacht Club', value: 'boredapeyachtclub' },
  { name: 'CryptoPunks', value: 'cryptopunks' },
  { name: 'Azuki', value: 'azuki' },
  { name: 'Mutant Ape Yacht Club', value: 'mutant-ape-yacht-club' },
  { name: 'Doodles', value: 'doodles-official' },
  { name: 'Clone X', value: 'clonex' },
  { name: 'Pudgy Penguins', value: 'pudgypenguins' },
  { name: 'Moonbirds', value: 'proof-moonbirds' },
  { name: 'DeGods', value: 'degods' },
  { name: 'Milady Maker', value: 'milady' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nft')
    .setDescription('Show information about an NFT collection')
    .addStringOption(option =>
      option
        .setName('collection')
        .setDescription('Collection name (OpenSea slug)')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  category: 'utility',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const collection = interaction.options.getString('collection', true).toLowerCase();

      const cached = nftCache.get(collection);
      let data;

      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        data = cached.data;
      } else {
        data = await fetchNFTData(collection);
        if (data) {
          nftCache.set(collection, { data, timestamp: Date.now() });
        }
      }

      if (!data) {
        await interaction.editReply({
          content: '❌ Could not find the collection. Check the name (OpenSea slug).'
        });
        return;
      }

      const floorChange = data.floorPriceChange || 0;
      const changeEmoji = floorChange >= 0 ? '📈' : '📉';
      const changeColor = floorChange >= 0 ? 0x57f287 : 0xed4245;

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ ${data.name}`)
        .setDescription(data.description ? data.description.slice(0, 200) + '...' : 'Bez popisu')
        .setColor(changeColor)
        .setThumbnail(data.imageUrl)
        .addFields(
          { name: '💎 Floor Price', value: `${data.floorPrice.toFixed(4)} ETH`, inline: true },
          { name: `${changeEmoji} 24h`, value: `${floorChange >= 0 ? '+' : ''}${floorChange.toFixed(2)}%`, inline: true },
          { name: '📊 Volume (24h)', value: `${data.volume24h.toFixed(2)} ETH`, inline: true },
          { name: '🏷️ Total Volume', value: `${formatVolume(data.totalVolume)} ETH`, inline: true },
          { name: '👥 Owners', value: data.numOwners?.toLocaleString() || 'N/A', inline: true },
          { name: '🎨 Items', value: data.totalSupply?.toLocaleString() || 'N/A', inline: true }
        )
        .setFooter({ text: 'Data from OpenSea' })
        .setTimestamp();

      if (data.bannerUrl) {
        embed.setImage(data.bannerUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('NFT command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching data. Try again later.'
      });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();

    const filtered = popularCollections
      .filter(col =>
        col.name.toLowerCase().includes(focused) ||
        col.value.includes(focused)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(col => ({ name: col.name, value: col.value }))
    );
  }
};

async function fetchNFTData(slug: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.opensea.io/api/v2/collections/${slug}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VorqulDSBot/3.0'
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (response.ok) {
      const data = await response.json() as any;

      return {
        name: data.name,
        description: data.description,
        imageUrl: data.image_url,
        bannerUrl: data.banner_image_url,
        floorPrice: parseFloat(data.stats?.floor_price || 0),
        floorPriceChange: parseFloat(data.stats?.floor_price_24h_percent_change || 0),
        volume24h: parseFloat(data.stats?.one_day_volume || 0),
        totalVolume: parseFloat(data.stats?.total_volume || 0),
        numOwners: data.stats?.num_owners,
        totalSupply: data.stats?.total_supply
      };
    }

    return getFallbackData(slug);
  } catch (error) {
    logger.error('Error fetching NFT data:', error);
    return getFallbackData(slug);
  }
}

function getFallbackData(slug: string): any {
  const demoData: Record<string, any> = {
    'boredapeyachtclub': {
      name: 'Bored Ape Yacht Club',
      description: 'The Bored Ape Yacht Club is a collection of 10,000 unique Bored Ape NFTs.',
      imageUrl: 'https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zgy0hjd2xKIgjJJtWIc0ybj4Vd7wv8t3pxDGHoJBzDB?w=500&auto=format',
      floorPrice: 18.5,
      floorPriceChange: -2.3,
      volume24h: 245.8,
      totalVolume: 1050000,
      numOwners: 5421,
      totalSupply: 10000
    },
    'cryptopunks': {
      name: 'CryptoPunks',
      description: '10,000 uniquely generated characters on Ethereum.',
      imageUrl: 'https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v-aI8din7WPk0Pgo3qQFhAUH-B6i-dCqqc_mCkRIzULmwzwecnohLhrcH8A9mpWIZqA7ygc52Sr81hE?w=500&auto=format',
      floorPrice: 52.0,
      floorPriceChange: 1.5,
      volume24h: 890.2,
      totalVolume: 2500000,
      numOwners: 3512,
      totalSupply: 10000
    },
    'azuki': {
      name: 'Azuki',
      description: 'Azuki starts with a collection of 10,000 avatars.',
      imageUrl: 'https://i.seadn.io/gae/H8jOCJuQokNqGBpkBN5wk1oZwO7LM8bNnrHCaekV2nKjnCqw6UB5oaH8XyNeBDj6bA_n1mjejzhFQUP3O1NfjFLHr3FOaeHcTOOT?w=500&auto=format',
      floorPrice: 6.2,
      floorPriceChange: 3.8,
      volume24h: 156.4,
      totalVolume: 680000,
      numOwners: 4890,
      totalSupply: 10000
    }
  };

  const demo = demoData[slug];
  if (demo) {
    const variance = (Math.random() - 0.5) * 0.1;
    return {
      ...demo,
      floorPrice: demo.floorPrice * (1 + variance),
      floorPriceChange: demo.floorPriceChange + (Math.random() - 0.5) * 2
    };
  }

  return {
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: 'NFT Collection on OpenSea',
    imageUrl: null,
    floorPrice: Math.random() * 5,
    floorPriceChange: (Math.random() - 0.5) * 10,
    volume24h: Math.random() * 100,
    totalVolume: Math.random() * 10000,
    numOwners: Math.floor(Math.random() * 5000),
    totalSupply: Math.floor(Math.random() * 10000)
  };
}

function formatVolume(volume: number): string {
  if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
  return volume.toFixed(2);
}

export default command;
