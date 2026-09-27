/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireGuildManager } from '@/lib/guildAuth';
import { logAudit } from '@/lib/audit';
import { getDashboardSettings } from '@/lib/guildSettings';

const DATA_DIR = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, 'backups')
  : path.join(process.cwd(), 'data', 'backups');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to create backup directory:', error);
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  try {
    const { guildId } = params;
    const botToken = process.env.DISCORD_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    if (!guildRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch guild' }, { status: guildRes.status });
    }

    const guild = await guildRes.json();

    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    const roles = rolesRes.ok ? await rolesRes.json() : [];

    const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    const channels = channelsRes.ok ? await channelsRes.json() : [];

    const channelMessages: Record<string, any[]> = {};

    for (const channel of channels) {
      if (channel.type === 0) {
        try {
          const messagesRes = await fetch(
            `https://discord.com/api/v10/channels/${channel.id}/messages?limit=10`,
            { headers: { Authorization: `Bot ${botToken}` } }
          );
          if (messagesRes.ok) {
            const messages = await messagesRes.json();
            channelMessages[channel.id] = messages.map((m: any) => ({
              id: m.id,
              content: m.content,
              author: {
                id: m.author.id,
                username: m.author.username,
                discriminator: m.author.discriminator
              },
              timestamp: m.timestamp,
              attachments: m.attachments,
              embeds: m.embeds
            }));
          }
        } catch (e) {
            console.debug('route: suppressed error', e);
          }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const emojisRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    const emojis = emojisRes.ok ? await emojisRes.json() : [];

    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        description: guild.description,
        splash: guild.splash,
        banner: guild.banner,
        preferredLocale: guild.preferred_locale,
        verificationLevel: guild.verification_level,
        defaultMessageNotifications: guild.default_message_notifications,
        explicitContentFilter: guild.explicit_content_filter,
        afkChannelId: guild.afk_channel_id,
        afkTimeout: guild.afk_timeout,
        systemChannelId: guild.system_channel_id,
        rulesChannelId: guild.rules_channel_id,
        publicUpdatesChannelId: guild.public_updates_channel_id
      },
      roles: roles
        .filter((r: any) => r.name !== '@everyone' && !r.managed)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          position: r.position,
          permissions: r.permissions,
          mentionable: r.mentionable
        }))
        .sort((a: any, b: any) => b.position - a.position),
      channels: channels.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parent_id,
        topic: c.topic,
        nsfw: c.nsfw,
        rateLimitPerUser: c.rate_limit_per_user,
        bitrate: c.bitrate,
        userLimit: c.user_limit,
        permissionOverwrites: c.permission_overwrites
      })).sort((a: any, b: any) => a.position - b.position),
      messages: channelMessages,
      emojis: emojis.map((e: any) => ({
        id: e.id,
        name: e.name,
        animated: e.animated
      })),
      botSettings: getDashboardSettings(guildId),
      statistics: {
        totalRoles: roles.length,
        totalChannels: channels.length,
        textChannels: channels.filter((c: any) => c.type === 0).length,
        voiceChannels: channels.filter((c: any) => c.type === 2).length,
        categories: channels.filter((c: any) => c.type === 4).length,
        totalMessages: Object.values(channelMessages).reduce((acc: number, msgs: any) => acc + msgs.length, 0),
        totalEmojis: emojis.length
      }
    };

    ensureDataDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${guildId}-${timestamp}.json`;
    const filepath = path.join(DATA_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'backup_create', `Created backup: ${filename}`);

    return NextResponse.json({
      success: true,
      filename,
      statistics: backup.statistics,
      createdAt: backup.createdAt
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  try {
    const { guildId } = params;
    ensureDataDir();

    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith(`backup-${guildId}-`) && f.endsWith('.json'))
      .sort()
      .reverse();

    const backups = files.map(filename => {
      const filepath = path.join(DATA_DIR, filename);
      const stats = fs.statSync(filepath);
      try {
        const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        return {
          filename,
          createdAt: content.createdAt,
          size: stats.size,
          statistics: content.statistics
        };
      } catch {
        return {
          filename,
          createdAt: stats.mtime.toISOString(),
          size: stats.size
        };
      }
    });

    return NextResponse.json({ backups, path: DATA_DIR });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json({ backups: [], path: DATA_DIR });
  }
}
