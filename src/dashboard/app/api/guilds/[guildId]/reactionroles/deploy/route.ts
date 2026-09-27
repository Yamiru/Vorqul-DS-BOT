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
      channel,
      title,
      description,
      color,
      type,
      username,
      avatarUrl,
      editMessageId,
      buttons
    } = body;

    if (!channel) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    if (!(await verifyChannelInGuild(guildId, channel, botToken))) {
      return NextResponse.json({ error: 'Channel does not belong to this guild' }, { status: 403 });
    }

    if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
      return NextResponse.json({ error: 'At least one button is required' }, { status: 400 });
    }

    if (buttons.length > 25) {
      return NextResponse.json({ error: 'Discord allows at most 25 buttons per message. Split the panel into two messages.' }, { status: 400 });
    }

    const missing: number[] = [];
    buttons.forEach((btn: any, idx: number) => {
      if (!btn.roleId) missing.push(idx + 1);
    });
    if (missing.length === buttons.length) {
      return NextResponse.json({ error: 'At least one button with a role is required' }, { status: 400 });
    }
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Button #${missing.join(', #')} has no role selected. Pick a role or remove the button.`
      }, { status: 400 });
    }

    const seenRoles = new Set<string>();
    for (let i = 0; i < buttons.length; i++) {
      if (seenRoles.has(buttons[i].roleId)) {
        return NextResponse.json({
          error: `Button #${i + 1} uses the same role as an earlier button. Each button needs a different role.`
        }, { status: 400 });
      }
      seenRoles.add(buttons[i].roleId);
    }

    const validButtons = buttons;
    const singleChoice = type === 'single';

    const _c = color ? parseInt(color.replace('#', ''), 16) : 5865458;
    const colorDecimal = Number.isNaN(_c) ? 5865458 : _c;

    const embed: any = {
      title: (title && title.trim()) || '🎭 Choose your role',
      description: (description && description.trim()) || 'Click a button to add or remove a role.',
      color: colorDecimal,
      footer: {
        text: 'Vorqul DS BOT • Reaction Roles'
      }
    };

    const components: any[] = [];
    let currentRow: any[] = [];

    for (let i = 0; i < validButtons.length; i++) {
      const btn = validButtons[i];

      const styleNum = parseInt(String(btn.style ?? 1), 10);
      const button: any = {
        type: 2,
        style: styleNum >= 1 && styleNum <= 4 ? styleNum : 1,

        custom_id: singleChoice ? `rr_${guildId}_${btn.roleId}_s` : `rr_${guildId}_${btn.roleId}`
      };

      if (btn.emoji && btn.emoji.trim()) {
        const emoji = btn.emoji.trim();
        const customMatch = emoji.match(/^<(a?):([\w~]+):(\d+)>$/);
        if (customMatch) {
          button.emoji = { id: customMatch[3], name: customMatch[2], animated: customMatch[1] === 'a' };
        } else if (/^\d+$/.test(emoji)) {
          button.emoji = { id: emoji };
        } else {
          button.emoji = { name: emoji };
        }
      }

      if (btn.label && btn.label.trim()) {
        button.label = btn.label.trim();
      } else if (!btn.emoji) {
        button.label = 'Role';
      }

      currentRow.push(button);

      if (currentRow.length === 5 || i === validButtons.length - 1) {
        components.push({
          type: 1,
          components: [...currentRow]
        });
        currentRow = [];
      }
    }

    const customName = typeof username === 'string' ? username.trim() : '';
    const customAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
    const useWebhook = !!(customName || customAvatar);
    const WEBHOOK_NAME = 'Vorqul Panels';
    const authHeaders = {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json'
    };

    const findOrCreateHook = async (create: boolean): Promise<any> => {
      const listRes = await fetch(`https://discord.com/api/v10/channels/${channel}/webhooks`, { headers: authHeaders });
      if (listRes.ok) {
        const hooks = await listRes.json();
        const found = hooks.find((w: any) => w.name === WEBHOOK_NAME && w.token);
        if (found) return found;
      }
      if (!create) return null;
      const createRes = await fetch(`https://discord.com/api/v10/channels/${channel}/webhooks`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: WEBHOOK_NAME })
      });
      if (!createRes.ok) {
        const error = await createRes.json().catch(() => ({}));
        console.error('Discord API error (create webhook):', error);
        return null;
      }
      return createRes.json();
    };

    let response: Response;

    if (editMessageId && /^\d+$/.test(String(editMessageId))) {
      const botEdit = await fetch(`https://discord.com/api/v10/channels/${channel}/messages/${editMessageId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ embeds: [embed], components })
      });

      if (botEdit.ok) {
        response = botEdit;
      } else if (botEdit.status === 403 || botEdit.status === 401 || botEdit.status === 404) {
        const hook = await findOrCreateHook(false);
        if (!hook) {
          return NextResponse.json({
            error: 'Could not update the panel. The original message may have been deleted - send it as a new panel instead.'
          }, { status: 404 });
        }
        response = await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}/messages/${editMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed], components })
        });
        if (response.status === 404) {
          return NextResponse.json({
            error: 'Could not update the panel. The original message may have been deleted - send it as a new panel instead.'
          }, { status: 404 });
        }
      } else {
        response = botEdit;
      }
    } else if (useWebhook) {
      const hook = await findOrCreateHook(true);
      if (!hook) {
        return NextResponse.json({
          error: 'Could not create a webhook for the custom name/avatar. Make sure the bot has the Manage Webhooks permission in that channel.'
        }, { status: 500 });
      }

      const payload: any = { embeds: [embed], components };
      if (customName) payload.username = customName;
      if (customAvatar) payload.avatar_url = customAvatar;

      response = await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
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
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({} as any));
      console.error('Discord API error:', error);
      return NextResponse.json({
        error: (error as any)?.message ? `Discord: ${(error as any).message}` : 'Failed to send message',
        details: error
      }, { status: response.status });
    }

    const message = await response.json();

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'reactionroles_deploy', `Deployed a reaction role panel to #${channel}`);

    return NextResponse.json({
      success: true,
      messageId: message.id,
      channelId: channel
    });
  } catch (error) {
    console.error('Error deploying reaction roles:', error);
    return NextResponse.json({ error: 'Failed to deploy reaction roles' }, { status: 500 });
  }
}
