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
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  if (!rateLimit(`write:${clientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  try {
    const { guildId } = params;
    const botToken = process.env.DISCORD_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      channelId,
      roleId,
      title,
      message,
      buttonText,
      color,
      type
    } = body;

    if (!channelId) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    if (!(await verifyChannelInGuild(guildId, channelId, botToken))) {
      return NextResponse.json({ error: 'Channel does not belong to this guild' }, { status: 403 });
    }

    const _c = color ? parseInt(color.replace('#', ''), 16) : 5763719;
    const colorDecimal = Number.isNaN(_c) ? 5763719 : _c;

    const embed: any = {
      title: (title && title.trim()) || '✅ Verification',
      description: (message && message.trim()) || 'Click the button below to verify and gain access to the server.',
      color: colorDecimal,
      footer: {
        text: 'Vorqul DS BOT • Verification System'
      }
    };

    let components: any[] = [];

    if (type === 'button' || !type) {
      components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              label: (buttonText && buttonText.trim()) || '✅ Verify',
              custom_id: `verify_${guildId}_${roleId || 'default'}`
            }
          ]
        }
      ];
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed],
        components
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Discord API error:', error);
      return NextResponse.json({ error: 'Failed to send message', details: error }, { status: response.status });
    }

    const msg = await response.json();

    if (type === 'reaction') {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}/reactions/✅/@me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });
    }

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'verification_deploy', `Deployed a verification panel to #${channelId}`);

    return NextResponse.json({
      success: true,
      messageId: msg.id,
      channelId
    });
  } catch (error) {
    console.error('Error deploying verification:', error);
    return NextResponse.json({ error: 'Failed to deploy verification' }, { status: 500 });
  }
}
