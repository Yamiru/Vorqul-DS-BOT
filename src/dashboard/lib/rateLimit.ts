/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
const buckets = new Map<string, { count: number; reset: number }>();
const MAX_BUCKETS = 20000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000 && buckets.size < MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.reset) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const real = req.headers.get('x-real-ip') || '';
  return (xff.split(',')[0] || real || 'unknown').trim() || 'unknown';
}
