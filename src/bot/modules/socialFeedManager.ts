/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { SocialFeed, GuildSettings } from '../../utils/models.js';
import { fetchRSS as fetchRssShared } from '../../shared/rssFeed.js';
interface FeedItem {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  author: string;
  authorUrl?: string;
  authorAvatar?: string;
  publishedAt: Date;
  description?: string;
  type: 'youtube' | 'twitch' | 'reddit' | 'rss' | 'instagram';
}

export class SocialFeedManager {
  private client: Client;
  private jobs: Map<string, CronJob> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    const job = new CronJob('*/5 * * * *', () => this.runCycle());
    job.start();
    this.jobs.set('main', job);
    logger.info('Social feed manager started');
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
    logger.info('Social feed manager stopped');
  }

  private async runCycle(): Promise<void> {
    await Promise.allSettled([this.checkAllFeeds(), this.checkSettingsFeeds()]);
  }

  private async checkAllFeeds(): Promise<void> {
    try {
      const feeds = await SocialFeed.find({ enabled: true });

      for (const feed of feeds) {
        try {
          const items = await this.fetchFeed(feed);
          await this.processItems(feed, items);
        } catch (error) {
          logger.error(`Error checking feed ${feed._id}:`, error as Error);
        }
      }
    } catch (error) {
      logger.error('Error in feed checker:', error as Error);
    }
  }

  private async fetchFeed(feed: any): Promise<FeedItem[]> {
    switch (feed.type) {
      case 'youtube':
        return this.fetchYouTube(feed.sourceId);
      case 'twitch':
        return this.fetchTwitch(feed.sourceId);
      case 'reddit':
        return this.fetchReddit(feed.sourceId);
      case 'rss':
        return this.fetchRSS(feed.sourceUrl);
      default:
        return [];
    }
  }

  private async fetchYouTube(channelId: string): Promise<FeedItem[]> {
    try {
      const response = await axios.get(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
        { timeout: 10000 }
      );

      const items: FeedItem[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(response.data)) !== null) {
        const entry = match[1];
        const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
        const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
        const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
        const authorName = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>/)?.[1];

        if (videoId && title) {
          items.push({
            id: videoId,
            title: this.decodeHtml(title),
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            author: authorName || 'Unknown',
            authorUrl: `https://www.youtube.com/channel/${channelId}`,
            publishedAt: new Date(published || Date.now()),
            type: 'youtube'
          });
        }
      }

      return items.slice(0, 5);
    } catch (error) {
      logger.error('YouTube fetch error:', error as Error);
      return [];
    }
  }

  private async fetchTwitch(username: string): Promise<FeedItem[]> {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;

      if (!clientId || !clientSecret) return [];

      const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials'
        }
      });

      const token = tokenRes.data.access_token;

      const userRes = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userRes.data.data[0]) return [];
      const userId = userRes.data.data[0].id;
      const userAvatar = userRes.data.data[0].profile_image_url;

      const streamRes = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`
        }
      });

      if (streamRes.data.data.length === 0) return [];

      const stream = streamRes.data.data[0];
      return [{
        id: stream.id,
        title: stream.title,
        url: `https://twitch.tv/${username}`,
        thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
        author: stream.user_name,
        authorUrl: `https://twitch.tv/${username}`,
        authorAvatar: userAvatar,
        publishedAt: new Date(stream.started_at),
        description: `Playing ${stream.game_name} for ${stream.viewer_count} viewers`,
        type: 'twitch'
      }];
    } catch (error) {
      logger.error('Twitch fetch error:', error as Error);
      return [];
    }
  }

  private async fetchReddit(subreddit: string): Promise<FeedItem[]> {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${subreddit}/new.json?limit=10`,
        {
          headers: { 'User-Agent': 'VorqulDSBot/1.0' },
          timeout: 10000
        }
      );

      return response.data.data.children.map((post: any) => ({
        id: post.data.id,
        title: post.data.title.substring(0, 256),
        url: `https://reddit.com${post.data.permalink}`,
        thumbnail: post.data.thumbnail?.startsWith('http') ? post.data.thumbnail : null,
        author: post.data.author,
        authorUrl: `https://reddit.com/u/${post.data.author}`,
        publishedAt: new Date(post.data.created_utc * 1000),
        description: post.data.selftext?.substring(0, 200) || null,
        type: 'reddit' as const
      }));
    } catch (error) {
      logger.error('Reddit fetch error:', error as Error);
      return [];
    }
  }

  private async fetchRSS(url: string): Promise<FeedItem[]> {
    try {
      const items = await fetchRssShared(url);
      return items.map((item) => ({ ...item, author: 'RSS Feed', type: 'rss' as const }));
    } catch (error) {
      logger.error('RSS fetch error:', error as Error);
      return [];
    }
  }

  private async processItems(feed: any, items: FeedItem[]): Promise<void> {
    const channel = this.client.channels.cache.get(feed.channelId) as TextChannel;
    if (!channel) return;

    for (const item of items) {
      if (feed.lastItems.includes(item.id)) continue;

      const embed = this.createEmbed(item, feed);

      try {
        await channel.send({
          content: feed.mentionRole ? `<@&${feed.mentionRole}>` : undefined,
          embeds: [embed]
        });

        feed.lastItems.unshift(item.id);
        if (feed.lastItems.length > 50) {
          feed.lastItems = feed.lastItems.slice(0, 50);
        }
        await feed.save();
      } catch (error) {
        logger.error('Error posting feed item:', error as Error);
      }
    }
  }

  private async fetchByPlatform(platform: string, account: string): Promise<FeedItem[]> {
    switch (platform) {
      case 'youtube': return this.fetchYouTube(account);
      case 'twitch': return this.fetchTwitch(account);
      case 'reddit': return this.fetchReddit(account);
      case 'rss': return this.fetchRSS(account);
      default: return [];
    }
  }

  private async checkSettingsFeeds(): Promise<void> {
    try {
      const rows = await GuildSettings.find({});
      const platforms = ['youtube', 'twitch', 'reddit', 'rss'] as const;

      for (const row of rows) {
        const socials = (row as any).socials;
        if (!socials || typeof socials !== 'object') continue;
        const guildId = (row as any).guild_id || (row as any).guildId;
        let changed = false;

        for (const platform of platforms) {
          const cfg = socials[platform];
          if (!cfg || cfg.enabled === false || !cfg.enabled || !cfg.channel) continue;

          const accounts: string[] = cfg.accounts || cfg.sources || [];
          if (!Array.isArray(accounts) || accounts.length === 0) continue;

          const channel = this.client.channels.cache.get(cfg.channel) as TextChannel | undefined;
          if (!channel || !channel.isTextBased?.()) continue;

          cfg.lastPosted = cfg.lastPosted || {};
          const content = [cfg.mention ? `<@&${cfg.mention}>` : '', cfg.message || ''].filter(Boolean).join(' ').trim() || undefined;

          for (const account of accounts) {
            const acc = String(account).trim();
            if (!acc) continue;
            try {
              const items = await this.fetchByPlatform(platform, acc);
              if (!items.length) continue;
              const lastId = cfg.lastPosted[acc];

              if (platform === 'twitch') {
                const it = items[0];
                if (it.id !== lastId) {
                  await channel.send({ content, embeds: [this.createEmbed(it, {})] });
                  cfg.lastPosted[acc] = it.id;
                  changed = true;
                }
                continue;
              }

              if (!lastId) {
                cfg.lastPosted[acc] = items[0].id;
                changed = true;
                continue;
              }
              const fresh: FeedItem[] = [];
              for (const it of items) {
                if (it.id === lastId) break;
                fresh.push(it);
              }
              if (!fresh.length) continue;
              for (const it of fresh.reverse()) {
                await channel.send({ content, embeds: [this.createEmbed(it, {})] });
              }
              cfg.lastPosted[acc] = items[0].id;
              changed = true;
            } catch (err) {
              logger.error(`Social feed ${platform}/${acc}:`, err as Error);
            }
          }
        }

        if (changed && guildId) {
          try {
            await GuildSettings.findOneAndUpdate({ guildId }, { $set: { socials } });
          } catch (err) {
            logger.error('Failed to persist social lastPosted:', err as Error);
          }
        }

        await this.checkPlainRssFeeds(row, guildId);
      }
    } catch (error) {
      logger.error('Error in settings social check:', error as Error);
    }
  }

  private async checkPlainRssFeeds(row: any, guildId: string): Promise<void> {
    const feeds = row?.feeds;
    if (!Array.isArray(feeds) || feeds.length === 0 || !guildId) return;

    let changed = false;

    for (const feed of feeds) {
      if (!feed || !feed.url || !feed.channel) continue;

      const channel = this.client.channels.cache.get(feed.channel) as TextChannel | undefined;
      if (!channel || !channel.isTextBased?.()) continue;

      try {
        const items = await this.fetchRSS(String(feed.url));
        if (!items.length) continue;

        const lastId = feed.lastPosted;

        if (!lastId) {
          feed.lastPosted = items[0].id;
          changed = true;
          continue;
        }

        const fresh: FeedItem[] = [];
        for (const item of items) {
          if (item.id === lastId) break;
          fresh.push(item);
        }
        if (!fresh.length) continue;

        for (const item of fresh.reverse()) {
          await channel.send({ embeds: [this.createEmbed(item, {})] });
        }

        feed.lastPosted = items[0].id;
        changed = true;
      } catch (err) {
        logger.error(`RSS feed ${feed.url}:`, err as Error);
      }
    }

    if (changed) {
      try {
        await GuildSettings.findOneAndUpdate({ guildId }, { $set: { feeds } });
      } catch (err) {
        logger.error('Failed to persist RSS lastPosted:', err as Error);
      }
    }
  }

  private createEmbed(item: FeedItem, feed: any): EmbedBuilder {
    const colors: Record<string, string> = {
      youtube: '#FF0000',
      twitch: '#9146FF',
      reddit: '#FF4500',
      rss: '#FFA500',
      instagram: '#E1306C'
    };

    const icons: Record<string, string> = {
      youtube: '📺',
      twitch: '🎮',
      reddit: '📰',
      rss: '📡',
      instagram: '📸'
    };

    const embed = new EmbedBuilder()
      .setTitle(`${icons[item.type]} ${item.title}`)
      .setURL(item.url)
      .setColor(colors[item.type] as `#${string}`)
      .setTimestamp(item.publishedAt);

    if (item.thumbnail) {
      embed.setImage(item.thumbnail);
    }

    if (item.description) {
      embed.setDescription(item.description);
    }

    if (item.author) {
      embed.setAuthor({
        name: item.author,
        url: item.authorUrl,
        iconURL: item.authorAvatar
      });
    }

    if (feed.customMessage) {
      embed.setFooter({ text: feed.customMessage });
    }

    return embed;
  }

  private decodeHtml(html: string): string {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '');
  }
}

export default SocialFeedManager;
