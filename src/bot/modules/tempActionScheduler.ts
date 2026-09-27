/*!
 * Vorqul DS BOT - Temporary Action Scheduler
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

export type TempActionType = 'ban' | 'role' | 'voicemute';

export interface TempAction {
  id: string;
  type: TempActionType;
  guildId: string;
  userId: string;
  roleId?: string;
  expiresAt: number;
  reason?: string;
  moderatorId?: string;
}

const CHECK_INTERVAL_MS = 30_000;

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function loadActions(guildId: string): Promise<TempAction[]> {
  const settings = await GuildSettings.findOne({ guildId });
  const raw = (settings as any)?.temp_actions;
  return Array.isArray(raw) ? raw : [];
}

async function saveActions(guildId: string, actions: TempAction[]): Promise<void> {
  await GuildSettings.findOneAndUpdate(
    { guildId },
    { $set: { temp_actions: actions } },
    { upsert: true }
  );
}

export async function scheduleTempAction(
  action: Omit<TempAction, 'id'>
): Promise<TempAction> {
  const actions = await loadActions(action.guildId);

  const filtered = actions.filter(
    (a) => !(a.userId === action.userId && a.type === action.type && a.roleId === action.roleId)
  );

  const entry: TempAction = { ...action, id: newId() };
  filtered.push(entry);
  await saveActions(action.guildId, filtered);

  return entry;
}

export async function cancelTempAction(
  guildId: string,
  userId: string,
  type: TempActionType,
  roleId?: string
): Promise<boolean> {
  const actions = await loadActions(guildId);
  const remaining = actions.filter(
    (a) => !(a.userId === userId && a.type === type && (roleId ? a.roleId === roleId : true))
  );

  if (remaining.length === actions.length) return false;
  await saveActions(guildId, remaining);
  return true;
}

export async function listTempActions(guildId: string): Promise<TempAction[]> {
  return loadActions(guildId);
}

async function revert(client: Client, action: TempAction): Promise<void> {
  const guild = client.guilds.cache.get(action.guildId);
  if (!guild) return;

  const reason = `Dočasné opatrenie vypršalo${action.reason ? `: ${action.reason}` : ''}`;

  if (action.type === 'ban') {
    await guild.bans.remove(action.userId, reason).catch(suppress('tempActionScheduler'));
    return;
  }

  const member = await guild.members.fetch(action.userId).catch(() => null);
  if (!member) return;

  if (action.type === 'role' && action.roleId) {
    if (member.roles.cache.has(action.roleId)) {
      await member.roles.remove(action.roleId, reason).catch(suppress('tempActionScheduler'));
    }
    return;
  }

  if (action.type === 'voicemute') {
    if (member.voice.serverMute) {
      await member.voice.setMute(false, reason).catch(suppress('tempActionScheduler'));
    }
  }
}

export function startTempActionScheduler(client: Client): void {
  const tick = async () => {
    const now = Date.now();

    for (const guild of client.guilds.cache.values()) {
      try {
        const actions = await loadActions(guild.id);
        if (actions.length === 0) continue;

        const expired = actions.filter((a) => a.expiresAt <= now);
        if (expired.length === 0) continue;

        for (const action of expired) {
          await revert(client, action).catch(suppress('tempActionScheduler'));
        }

        await saveActions(guild.id, actions.filter((a) => a.expiresAt > now));
        logger.debug(`Reverted ${expired.length} temporary actions in ${guild.id}`);
      } catch (error) {
        logger.error(`Temp action tick failed for ${guild.id}:`, error as Error);
      }
    }
  };

  setTimeout(() => { tick().catch(suppress('tempActionScheduler')); }, 5_000);

  const timer = setInterval(() => { tick().catch(suppress('tempActionScheduler')); }, CHECK_INTERVAL_MS);
  timer.unref?.();

  logger.info('Temporary action scheduler started');
}
