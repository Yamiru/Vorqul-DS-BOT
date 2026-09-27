/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, 'uploads')
  : path.join(process.cwd(), 'data', 'uploads');

export interface Attachment {
  name: string;
  buffer: Buffer;
  contentType: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function hexToColor(hex?: string): number | undefined {
  if (!hex || typeof hex !== 'string') return undefined;
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n) || n < 0 || n > 0xffffff) return undefined;
  return n;
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export function resolveImage(value: string | undefined, files: Attachment[], prefix: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  if (v.startsWith('http://') || v.startsWith('https://')) return v;

  const dataMatch = v.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (dataMatch) {
    const mime = dataMatch[1];
    const ext = EXT_BY_MIME[mime] || 'png';
    try {
      const buffer = Buffer.from(dataMatch[2], 'base64');
      const name = `${prefix}_${files.length}.${ext}`;
      files.push({ name, buffer, contentType: mime });
      return `attachment://${name}`;
    } catch { return null; }
  }

  const upMatch = v.match(/\/uploads\/([^/?#]+)$/);
  if (upMatch) {
    const filename = upMatch[1];
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      if (fs.existsSync(filepath)) {
        const buffer = fs.readFileSync(filepath);
        const ext = (filename.split('.').pop() || 'png').toLowerCase();
        const mime = Object.keys(EXT_BY_MIME).find(m => EXT_BY_MIME[m] === ext) || 'image/png';
        files.push({ name: filename, buffer, contentType: mime });
        return `attachment://${filename}`;
      }
    } catch (error) {
        console.debug('discordMessage: suppressed error', error);
      }
    return null;
  }

  return null;
}

export function buildEmbed(data: any, files: Attachment[]): any | null {
  const embed: any = {};
  if (data.title && String(data.title).trim()) embed.title = truncate(String(data.title).trim(), 256);
  if (data.description && String(data.description).trim()) embed.description = truncate(String(data.description).trim(), 4096);
  if (data.url && /^https?:\/\//.test(String(data.url).trim())) embed.url = String(data.url).trim();
  const color = hexToColor(data.color);
  if (color !== undefined) embed.color = color;
  if (data.author && String(data.author).trim()) embed.author = { name: truncate(String(data.author).trim(), 256) };
  if (data.footer && String(data.footer).trim()) embed.footer = { text: truncate(String(data.footer).trim(), 2048) };
  if (data.timestamp) embed.timestamp = new Date().toISOString();

  const img = resolveImage(data.image, files, 'embed_image');
  if (img) embed.image = { url: img };
  const thumb = resolveImage(data.thumbnail, files, 'embed_thumb');
  if (thumb) embed.thumbnail = { url: thumb };

  if (Array.isArray(data.fields)) {
    const fields = data.fields
      .filter((f: any) => f && f.name && f.value)
      .slice(0, 25)
      .map((f: any) => ({ name: truncate(String(f.name), 256), value: truncate(String(f.value), 1024), inline: !!f.inline }));
    if (fields.length) embed.fields = fields;
  }

  const hasContent = embed.title || embed.description || embed.fields || embed.image || embed.author;
  return hasContent ? embed : null;
}

const WEBHOOK_NAME = 'Vorqul Panels';

async function findOrCreateWebhook(channelId: string, botToken: string): Promise<{ id: string; token: string } | null> {
  const authHeaders = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
  const listRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, { headers: authHeaders });
  if (listRes.ok) {
    const hooks = await listRes.json();
    const found = hooks.find((w: any) => w.name === WEBHOOK_NAME && w.token);
    if (found) return found;
  }
  const createRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: WEBHOOK_NAME })
  });
  if (!createRes.ok) return null;
  return createRes.json();
}

export async function postMessage(
  channelId: string,
  payload: any,
  files: Attachment[],
  botToken: string,
  sender?: { username?: string; avatarUrl?: string }
): Promise<{ ok: boolean; status: number; body: any }> {
  const customName = (sender?.username || '').trim();
  const customAvatar = (sender?.avatarUrl || '').trim();
  const useWebhook = !!(customName || customAvatar);

  let url: string;
  let authHeader: Record<string, string>;

  if (useWebhook) {
    const hook = await findOrCreateWebhook(channelId, botToken);
    if (!hook) {
      return {
        ok: false, status: 403,
        body: { message: 'Could not create a webhook for the custom name/avatar. Make sure the bot has the Manage Webhooks permission in that channel.' }
      };
    }
    url = `https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`;
    authHeader = {};
    payload = { ...payload };
    if (customName) payload.username = customName;
    if (customAvatar) payload.avatar_url = customAvatar;
  } else {
    url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    authHeader = { Authorization: `Bot ${botToken}` };
  }

  let res: Response;

  if (files.length > 0) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    files.forEach((f, i) => {
      form.append(`files[${i}]`, new Blob([new Uint8Array(f.buffer)], { type: f.contentType }), f.name);
    });
    res = await fetch(url, {
      method: 'POST',
      headers: authHeader,
      body: form,
    });
  } else {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  let body: any = {};
  try {
    body = await res.json();
  } catch (error) {
    console.debug('discordMessage: suppressed error', error);
  }
  return { ok: res.ok, status: res.status, body };
}
