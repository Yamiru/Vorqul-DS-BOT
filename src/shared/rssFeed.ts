/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import axios from 'axios';

export interface RssItem {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  description?: string;
}

export function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '');
}

export async function fetchRSS(url: string): Promise<RssItem[]> {
  const response = await axios.get(url, { timeout: 10000 });
  const items: RssItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(response.data)) !== null && items.length < 10) {
    const item = match[1];
    const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1];
    const link = item.match(/<link>(.*?)<\/link>/)?.[1];
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
    const description = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1];
    const guid = item.match(/<guid.*?>(.*?)<\/guid>/)?.[1];

    if (title && link) {
      items.push({
        id: guid || link,
        title: decodeHtml(title),
        url: link,
        publishedAt: new Date(pubDate || Date.now()),
        description: description ? decodeHtml(description).substring(0, 200) : undefined
      });
    }
  }

  return items;
}

export function rssItemEmbed(item: RssItem, footerText?: string): Record<string, unknown> {
  const embed: Record<string, unknown> = {
    title: `📡 ${item.title}`.slice(0, 256),
    url: item.url,
    color: 0xffa500,
    timestamp: item.publishedAt.toISOString(),
    author: { name: 'RSS Feed' }
  };
  if (item.description) embed.description = item.description;
  if (footerText) embed.footer = { text: footerText };
  return embed;
}
