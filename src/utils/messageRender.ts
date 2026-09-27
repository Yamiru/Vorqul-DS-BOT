/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { EmbedBuilder } from 'discord.js';

export type MessageMode = 'plain' | 'embed';

export interface MessageConfig {
  content?: string;
  message?: string;
  title?: string;
  description?: string;
  author?: string;
  footer?: string;
  color?: string;
  image?: string;
  thumbnail?: string;
  timestamp?: boolean;
}

export interface RenderResult {
  content?: string;
  embeds?: EmbedBuilder[];
}

export interface RenderDefaults {
  plainText?: string;
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
}

export function applyVars(text: string | undefined, vars: Record<string, string>): string | undefined {
  if (!text) return text;
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), () => value ?? '');
  }
  return out;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function hexToInt(hex?: string): number | undefined {
  if (!hex || typeof hex !== 'string') return undefined;
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n) || n < 0 || n > 0xffffff) return undefined;
  return n;
}

function resolveImage(value: string | undefined, vars: Record<string, string>): string | undefined {
  const v = applyVars(value, vars)?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//.test(v)) return v;
  return undefined;
}

export function buildConfiguredMessage(
  mode: MessageMode,
  cfg: MessageConfig | undefined,
  vars: Record<string, string>,
  defaults: RenderDefaults = {}
): RenderResult {
  const c = cfg || {};
  const plainText = applyVars(c.content ?? c.message, vars) ?? defaults.plainText;

  if (mode !== 'embed') {
    return { content: truncate(plainText || defaults.plainText || '', 2000) };
  }

  const embed = new EmbedBuilder();

  const title = applyVars(c.title, vars) || defaults.title;
  if (title) embed.setTitle(truncate(title, 256));

  const description = applyVars(c.description, vars) || defaults.description || plainText;
  if (description) embed.setDescription(truncate(description, 4096));

  const color = hexToInt(c.color) ?? defaults.color;
  if (color !== undefined) embed.setColor(color);

  const author = applyVars(c.author, vars);
  if (author) embed.setAuthor({ name: truncate(author, 256) });

  const image = resolveImage(c.image, vars);
  if (image) embed.setImage(image);

  const thumbnail = resolveImage(c.thumbnail, vars) ?? defaults.thumbnail;
  if (thumbnail) embed.setThumbnail(thumbnail);

  const footer = applyVars(c.footer, vars);
  if (footer) embed.setFooter({ text: truncate(footer, 2048) });

  if (c.timestamp) embed.setTimestamp();

  const outside = applyVars(c.content, vars);
  const hasEmbedBody = !!(title || description || image || author);

  return {
    content: hasEmbedBody && outside ? truncate(outside, 2000) : undefined,
    embeds: [embed],
  };
}
