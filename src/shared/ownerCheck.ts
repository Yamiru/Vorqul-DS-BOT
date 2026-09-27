/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */

// BOT_OWNER_ID may hold several Discord user IDs separated by commas.
export function ownerIdsFromEnv(): string[] {
  return (process.env.BOT_OWNER_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isEnvOwner(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return ownerIdsFromEnv().includes(userId);
}
