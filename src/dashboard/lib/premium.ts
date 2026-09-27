/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';

export type PremiumTier = 'free' | 'premium' | 'pro';

export const TIER_LIMITS: Record<PremiumTier, Record<string, number>> = {
  free: { stickyMessages: 3, reactionRoles: 5, autoResponses: 10, scheduledMessages: 5, webhooks: 0 },
  premium: { stickyMessages: 15, reactionRoles: 25, autoResponses: 50, scheduledMessages: 25, webhooks: 1 },
  pro: { stickyMessages: 100, reactionRoles: 100, autoResponses: 500, scheduledMessages: 200, webhooks: 5 }
};

const DATA_DIR = process.env.DATA_PATH || './data';
const FILE = path.join(DATA_DIR, 'json', 'premium_guilds.json');

export function getPremiumTier(guildId: string): PremiumTier {
  const env = (process.env.PREMIUM_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (env.includes(guildId)) return 'pro';
  try {
    if (fs.existsSync(FILE)) {
      const rows = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      const r = rows.find((x: any) => x.guild_id === guildId);
      if (r?.tier) {
        if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) return 'free';
        if (r.tier === 'premium' || r.tier === 'pro') return r.tier;
      }
    }
  } catch (error) {
      console.debug('premium: suppressed error', error);
    }
  return 'free';
}

export function getLimits(tier: PremiumTier): Record<string, number> {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}
