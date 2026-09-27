/*!
 * Vorqul DS BOT - Per-Guild Identity
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Guild } from 'discord.js';
import { getBotNickname } from '../../utils/guildCache.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

const MAX_NICKNAME_LENGTH = 32;

export interface NicknameResult {
  ok: boolean;
  reason?: string;
  applied?: string | null;
}

export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  const trimmed = nickname.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Prezývka nemôže byť prázdna. Na zrušenie použi „reset".' };
  }
  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    return {
      valid: false,
      error: `Prezývka môže mať najviac ${MAX_NICKNAME_LENGTH} znakov (zadal si ${trimmed.length}).`,
    };
  }
  return { valid: true };
}

export async function applyNickname(
  guild: Guild,
  nickname: string | null
): Promise<NicknameResult> {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'Bot nie je členom tohto servera.' };

  const current = me.nickname ?? null;
  if (current === nickname) return { ok: true, applied: nickname };

  try {
    await me.setNickname(nickname, 'Nastavenie mena bota pre tento server');
    return { ok: true, applied: nickname };
  } catch (error: any) {
    if (error?.code === 50013) {
      return {
        ok: false,
        reason: 'Chýba mi oprávnenie „Zmeniť prezývku" (Change Nickname) na tomto serveri.',
      };
    }
    return { ok: false, reason: 'Prezývku sa nepodarilo zmeniť.' };
  }
}

export async function syncGuildNickname(guild: Guild): Promise<void> {
  const desired = getBotNickname(guild.id) ?? null;
  const me = guild.members.me;
  if (!me) return;

  const current = me.nickname ?? null;
  if (current === desired) return;

  const result = await applyNickname(guild, desired);
  if (!result.ok) {
    logger.warn(`[${guild.name}] Meno bota sa nedalo nastaviť: ${result.reason}`);
    return;
  }

  logger.info(
    desired
      ? `[${guild.name}] Meno bota nastavené na "${desired}"`
      : `[${guild.name}] Meno bota vrátené na globálne`
  );
}

export async function syncAllNicknames(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    await syncGuildNickname(guild).catch(suppress('botIdentity'));
  }
}

export function startIdentitySync(client: Client, intervalMs = 5 * 60_000): void {
  setTimeout(() => {
    syncAllNicknames(client).catch(suppress('botIdentity'));
  }, 10_000);

  const timer = setInterval(() => {
    syncAllNicknames(client).catch(suppress('botIdentity'));
  }, intervalMs);
  timer.unref?.();

  client.on('guildCreate', (guild: Guild) => {
    syncGuildNickname(guild).catch(suppress('botIdentity'));
  });

  logger.info('Per-guild bot identity sync started');
}
