/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */

// The dashboard polls /api/status every 15s, but GitHub must only be asked
// once every few hours - one shared in-memory cache serves every request in
// between, and a failed check is retried sooner than a successful one.
const VERSION_URL = 'https://raw.githubusercontent.com/Yamiru/Vorqul-DS-BOT/main/.version';
const CACHE_MS = 6 * 60 * 60_000;
const RETRY_MS = 30 * 60_000;

let cache: { version: string | null; expires: number } | null = null;

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function getLatestVersion(): Promise<string | null> {
  const now = Date.now();
  if (cache && now < cache.expires) return cache.version;

  const version = await fetchLatestVersion();
  cache = { version, expires: now + (version ? CACHE_MS : RETRY_MS) };
  return version;
}

function parseParts(version: string): number[] {
  return version.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseParts(latest);
  const b = parseParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
