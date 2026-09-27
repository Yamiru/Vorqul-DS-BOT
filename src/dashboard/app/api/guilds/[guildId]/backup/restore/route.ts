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
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { patchSettings } from '@/lib/guildSettings';

type RestoreMode = 'full' | 'server' | 'bot';

const DATA_DIR = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, 'backups')
  : path.join(process.cwd(), 'data', 'backups');

const DELAY_MS = 350;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function discord(botToken: string, url: string, init?: RequestInit) {
  const res = await fetch(`https://discord.com/api/v10${url}`, {
    ...init,
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  await sleep(DELAY_MS);
  return res;
}

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  if (!rateLimit(`backup-restore:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  const { guildId } = params;
  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const filename = String(body.filename || '');
  const mode: RestoreMode = body.mode === 'server' || body.mode === 'bot' ? body.mode : 'full';

  if (!/^backup-\d+-[A-Za-z0-9_-]+\.json$/.test(filename) || !filename.startsWith(`backup-${guildId}-`)) {
    return NextResponse.json({ error: 'Invalid backup filename' }, { status: 400 });
  }

  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  let backup: any;
  try {
    backup = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return NextResponse.json({ error: 'Backup file is corrupted' }, { status: 500 });
  }

  const summary = { rolesCreated: 0, rolesUpdated: 0, channelsCreated: 0, channelsUpdated: 0, botSettingsRestored: false, errors: [] as string[] };
  const roleIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();

  if (mode === 'bot') {
    if (backup.botSettings && typeof backup.botSettings === 'object') {
      try {
        patchSettings(guildId, backup.botSettings);
        summary.botSettingsRestored = true;
      } catch (error) {
        console.error('Error restoring bot settings:', error);
        summary.errors.push('bot settings: could not save');
      }
    } else {
      summary.errors.push('bot settings: this backup has none (made before the feature was added)');
    }

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'backup_restore', `Restored bot settings from backup ${filename}${summary.errors.length ? `, ${summary.errors.length} error(s)` : ''}`);
    return NextResponse.json({ success: true, summary });
  }

  try {
    // 1) Roles - restored first so channels can remap permission overwrites onto them.
    const rolesRes = await discord(botToken, `/guilds/${guildId}/roles`);
    const currentRoles: any[] = rolesRes.ok ? await rolesRes.json() : [];

    for (const role of backup.roles || []) {
      const existing = currentRoles.find((r) => r.name === role.name && !r.managed);
      const payload = {
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable
      };
      try {
        if (existing) {
          const res = await discord(botToken, `/guilds/${guildId}/roles/${existing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
          if (res.ok) { roleIdMap.set(role.id, existing.id); summary.rolesUpdated++; }
          else summary.errors.push(`role ${role.name}: update failed (${res.status})`);
        } else {
          const res = await discord(botToken, `/guilds/${guildId}/roles`, { method: 'POST', body: JSON.stringify(payload) });
          if (res.ok) { const created = await res.json(); roleIdMap.set(role.id, created.id); summary.rolesCreated++; }
          else summary.errors.push(`role ${role.name}: create failed (${res.status})`);
        }
      } catch {
        summary.errors.push(`role ${role.name}: network error`);
      }
    }

    // 2) Server settings - only the ones that don't reference a channel ID (those may no longer exist).
    if (backup.guild) {
      const g = backup.guild;
      const guildPayload = {
        verification_level: g.verificationLevel,
        default_message_notifications: g.defaultMessageNotifications,
        explicit_content_filter: g.explicitContentFilter,
        afk_timeout: g.afkTimeout
      };
      try {
        const res = await discord(botToken, `/guilds/${guildId}`, { method: 'PATCH', body: JSON.stringify(guildPayload) });
        if (!res.ok) summary.errors.push(`server settings: update failed (${res.status})`);
      } catch {
        summary.errors.push('server settings: network error');
      }
    }

    // 3) Channels - categories first so child channels can remap parent_id.
    const remapOverwrites = (overwrites: any[]) =>
      (Array.isArray(overwrites) ? overwrites : [])
        .filter((o) => o.type === 1 || (o.type === 0 && roleIdMap.has(o.id)))
        .map((o) => ({ ...o, id: o.type === 0 ? roleIdMap.get(o.id) : o.id }));

    const channelsRes = await discord(botToken, `/guilds/${guildId}/channels`);
    const currentChannels: any[] = channelsRes.ok ? await channelsRes.json() : [];
    const backupChannels: any[] = backup.channels || [];

    const restoreChannel = async (ch: any, parentId: string | null) => {
      const existing = currentChannels.find((c) => c.name === ch.name && c.type === ch.type);
      const payload: Record<string, unknown> = {
        name: ch.name,
        topic: ch.topic ?? undefined,
        nsfw: ch.nsfw,
        rate_limit_per_user: ch.rateLimitPerUser,
        bitrate: ch.type === 2 ? ch.bitrate : undefined,
        user_limit: ch.type === 2 ? ch.userLimit : undefined,
        permission_overwrites: remapOverwrites(ch.permissionOverwrites),
        parent_id: parentId
      };
      try {
        if (existing) {
          const res = await discord(botToken, `/channels/${existing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
          if (res.ok) { summary.channelsUpdated++; return existing.id; }
          summary.errors.push(`channel #${ch.name}: update failed (${res.status})`);
          return existing.id;
        }
        const res = await discord(botToken, `/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify({ ...payload, type: ch.type }) });
        if (res.ok) { const created = await res.json(); summary.channelsCreated++; return created.id; }
        summary.errors.push(`channel #${ch.name}: create failed (${res.status})`);
        return null;
      } catch {
        summary.errors.push(`channel #${ch.name}: network error`);
        return null;
      }
    };

    for (const ch of backupChannels.filter((c) => c.type === 4)) {
      const newId = await restoreChannel(ch, null);
      if (newId) categoryIdMap.set(ch.id, newId);
    }
    for (const ch of backupChannels.filter((c) => c.type !== 4)) {
      const parentId = ch.parentId ? categoryIdMap.get(ch.parentId) || null : null;
      await restoreChannel(ch, parentId);
    }

    // 4) Bot (Vorqul) settings - only for a full restore, not a server-only one.
    if (mode === 'full') {
      if (backup.botSettings && typeof backup.botSettings === 'object') {
        try {
          patchSettings(guildId, backup.botSettings);
          summary.botSettingsRestored = true;
        } catch (error) {
          console.error('Error restoring bot settings:', error);
          summary.errors.push('bot settings: could not save');
        }
      } else {
        summary.errors.push('bot settings: this backup has none (made before the feature was added)');
      }
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Restore failed partway through', summary }, { status: 500 });
  }

  const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
  logAudit(
    guildId,
    actor,
    'backup_restore',
    `Restored backup ${filename} (${mode}): ${summary.rolesCreated} roles created, ${summary.rolesUpdated} updated, ${summary.channelsCreated} channels created, ${summary.channelsUpdated} updated${summary.botSettingsRestored ? ', bot settings restored' : ''}${summary.errors.length ? `, ${summary.errors.length} error(s)` : ''}`
  );

  return NextResponse.json({ success: true, summary });
}
