/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager, verifyChannelInGuild } from '@/lib/guildAuth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getDashboardSettings, patchSettings } from '@/lib/guildSettings';
import { logAudit } from '@/lib/audit';
import { fetchRSS, rssItemEmbed } from '@shared/rssFeed';

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;

  if (!rateLimit(`write:${clientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  const { guildId } = params;
  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const index = Number(body.index);

  const settings = getDashboardSettings(guildId);
  const feeds = Array.isArray(settings.feeds) ? settings.feeds : [];
  const feed = feeds[index];
  if (!feed || !feed.url || !feed.channel) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }

  if (!(await verifyChannelInGuild(guildId, feed.channel, botToken))) {
    return NextResponse.json({ error: 'Channel does not belong to this guild' }, { status: 403 });
  }

  let items;
  try {
    items = await fetchRSS(feed.url);
  } catch {
    return NextResponse.json({ error: 'Could not fetch the RSS feed' }, { status: 502 });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'The feed has no items to send' }, { status: 404 });
  }

  const latest = items[0];
  const response = await fetch(`https://discord.com/api/v10/channels/${feed.channel}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [rssItemEmbed(latest)] })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return NextResponse.json({ error: (error as any)?.message ? `Discord: ${(error as any).message}` : 'Failed to send message' }, { status: response.status });
  }

  const nextFeeds = [...feeds];
  nextFeeds[index] = { ...feed, lastPosted: latest.id };
  patchSettings(guildId, { feeds: nextFeeds });

  const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
  logAudit(guildId, actor, 'feed_force_send', `Manually sent feed: ${feed.url}`);

  return NextResponse.json({ success: true, title: latest.title });
}
