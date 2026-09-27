/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';

export type PremiumTier = 'free' | 'premium' | 'pro';

export const TIER_LIMITS: Record<PremiumTier, Record<string, number>> = {
  free: { stickyMessages: 3, reactionRoles: 5, autoResponses: 10, scheduledMessages: 5, webhooks: 0 },
  premium: { stickyMessages: 15, reactionRoles: 25, autoResponses: 50, scheduledMessages: 25, webhooks: 1 },
  pro: { stickyMessages: 100, reactionRoles: 100, autoResponses: 500, scheduledMessages: 200, webhooks: 5 }
};

function envPremiumGuilds(): Set<string> {
  return new Set((process.env.PREMIUM_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean));
}

export async function getPremiumTier(guildId: string): Promise<PremiumTier> {
  if (envPremiumGuilds().has(guildId)) return 'pro';
  try {
    const row: any = await getDatabase().findOne('premium_guilds', { guild_id: guildId });
    if (row && row.tier) {
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return 'free';
      if (row.tier === 'premium' || row.tier === 'pro') return row.tier;
    }
  } catch (error) {
      logger.debug('premium: suppressed error', error);
    }
  return 'free';
}

export function getLimits(tier: PremiumTier): Record<string, number> {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

export async function getLimit(guildId: string, key: string): Promise<number> {
  const tier = await getPremiumTier(guildId);
  return getLimits(tier)[key] ?? 0;
}
