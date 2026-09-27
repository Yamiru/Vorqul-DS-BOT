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
      panelChannel,
      panelTitle,
      panelDescription,
      panelColor,
      buttonText,
      categoryId,
      categories
    } = body;

    if (!panelChannel) {
      return NextResponse.json({ error: 'Panel channel is required' }, { status: 400 });
    }

    if (!(await verifyChannelInGuild(guildId, panelChannel, botToken))) {
      return NextResponse.json({ error: 'Channel does not belong to this guild' }, { status: 403 });
    }

    const _c = panelColor ? parseInt(panelColor.replace('#', ''), 16) : 5865458;
    const colorDecimal = Number.isNaN(_c) ? 5865458 : _c;

    const embed: any = {
      title: (panelTitle && panelTitle.trim()) || '🎫 Support',
      description: (panelDescription && panelDescription.trim()) || 'Need help? Click the button below to open a ticket!\n\n**Rules:**\n• Describe your problem as precisely as possible\n• Be patient, we will reply as soon as we can\n• Do not abuse the ticket system',
      color: colorDecimal,
      footer: {
        text: 'Vorqul DS BOT • Ticket System'
      },
      timestamp: new Date().toISOString()
    };

    const cats: any[] = Array.isArray(categories) ? categories.filter((c: any) => c && c.label) : [];
    let components: any[];

    if (cats.length > 0) {
      const rows: any[] = [];
      for (let i = 0; i < cats.length && rows.length < 5; i += 5) {
        const chunk = cats.slice(i, i + 5);
        rows.push({
          type: 1,
          components: chunk.map((c: any, j: number) => {
            const idx = i + j;
            const btn: any = {
              type: 2,
              style: 1,
              label: String(c.label).slice(0, 80),
              custom_id: `ticket_create_${guildId}_cat${idx}`
            };
            if (c.emoji && String(c.emoji).trim()) btn.emoji = { name: String(c.emoji).trim() };
            return btn;
          })
        });
      }
      components = rows;
    } else {
      components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: (buttonText && buttonText.trim()) || '📩 Create a ticket',
              custom_id: `ticket_create_${guildId}_${categoryId || 'default'}`
            }
          ]
        }
      ];
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${panelChannel}/messages`, {
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

    const message = await response.json();

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'tickets_deploy', `Deployed a ticket panel to #${panelChannel}`);

    return NextResponse.json({
      success: true,
      messageId: message.id,
      channelId: panelChannel
    });
  } catch (error) {
    console.error('Error deploying ticket panel:', error);
    return NextResponse.json({ error: 'Failed to deploy ticket panel' }, { status: 500 });
  }
}
