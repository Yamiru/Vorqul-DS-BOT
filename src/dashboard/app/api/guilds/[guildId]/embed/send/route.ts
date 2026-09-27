/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildEmbed, postMessage, truncate, Attachment } from '@/lib/discordMessage';
import { requireGuildManager, verifyChannelInGuild } from '@/lib/guildAuth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  if (!rateLimit(`write:${clientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  try {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { channel, content } = body;

    if (!channel) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    if (!(await verifyChannelInGuild(params.guildId, channel, botToken))) {
      return NextResponse.json({ error: 'Channel does not belong to this guild' }, { status: 403 });
    }

    const files: Attachment[] = [];
    const embed = body.plain ? null : buildEmbed(body, files);

    const payload: any = {};
    if (content && String(content).trim()) {
      payload.content = truncate(String(content).trim(), 2000);

      payload.allowed_mentions = { parse: ['everyone', 'roles', 'users'] };
    }
    if (embed) payload.embeds = [embed];

    if (!payload.content && !payload.embeds && files.length === 0) {
      return NextResponse.json({ error: 'Message must have content or an embed' }, { status: 400 });
    }

    const result = await postMessage(channel, payload, files, botToken, {
      username: body.username,
      avatarUrl: body.avatarUrl
    });

    if (!result.ok) {
      console.error('Discord API error:', result.body);
      return NextResponse.json({
        error: result.body?.message ? `Discord: ${result.body.message}` : 'Failed to send message',
        details: result.body
      }, { status: result.status });
    }

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(params.guildId, actor, 'embed_send', `Sent an embed message to #${channel}`);

    return NextResponse.json({ success: true, messageId: result.body.id, channelId: channel });
  } catch (error) {
    console.error('Error sending embed:', error);
    return NextResponse.json({ error: 'Failed to send embed' }, { status: 500 });
  }
}
