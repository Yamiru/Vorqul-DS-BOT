/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */

const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 4000;
// A data: URI holding an uploaded image (see api/guilds/[guildId]/upload) can be
// far longer than any ordinary setting - up to ~700KB of base64 for the 500KB
// file cap that route enforces. Such values get their own, much higher limit
// instead of the plain-text one below.
const MAX_DATA_URI_LENGTH = 700_000;
const MAX_ARRAY_LENGTH = 200;
const MAX_OBJECT_KEYS = 200;
// Large enough to fit one uploaded image (see MAX_DATA_URI_LENGTH) alongside
// the rest of a normal settings payload, while still bounding request size.
const MAX_PAYLOAD_BYTES = 1536 * 1024;

const SNOWFLAKE = /^\d{15,25}$/;

const ID_FIELD_SUFFIX = /(channel|role|category|guild|user)(s|id)?$/i;
const DATA_URI_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

function looksLikeIdField(key: string): boolean {
  return ID_FIELD_SUFFIX.test(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return undefined;

  if (value === null || value === undefined) return value;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const isDataUriImage = DATA_URI_IMAGE.test(value);
    const limit = isDataUriImage ? MAX_DATA_URI_LENGTH : MAX_STRING_LENGTH;
    const truncated = value.length > limit ? value.slice(0, limit) : value;
    if (!isDataUriImage && looksLikeIdField(key) && truncated.trim() !== '' && !SNOWFLAKE.test(truncated.trim())) {
      return undefined;
    }
    return truncated;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(key, item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    return sanitizeObject(value, depth + 1);
  }

  return undefined;
}

function sanitizeObject(obj: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const entries = Object.entries(obj).slice(0, MAX_OBJECT_KEYS);
  for (const [key, value] of entries) {
    const cleaned = sanitizeValue(key, value, depth);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export function validateSettingsPatch(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  let byteSize: number;
  try {
    byteSize = Buffer.byteLength(JSON.stringify(body), 'utf-8');
  } catch {
    return { ok: false, error: 'Payload could not be serialized.' };
  }

  if (byteSize > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: `Payload too large (${Math.round(byteSize / 1024)}KB, max ${MAX_PAYLOAD_BYTES / 1024}KB).` };
  }

  return { ok: true, data: sanitizeObject(body, 0) };
}
