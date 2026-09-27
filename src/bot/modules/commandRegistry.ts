/*!
 * Vorqul DS BOT - Command Registry
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import type { Collection } from 'discord.js';
import type { Command } from '../types.js';
import { logger } from '../../utils/logger.js';

export const DISCORD_GLOBAL_COMMAND_LIMIT = 100;

export const LOW_PRIORITY_COMMANDS = [
  'matchmaking',
  'gamestats',
  'quest',
  'referral',
  'streak',
  'digest',
  'whatdidimiss',
  'altcheck',
  'feed',
  'trivia',
  'connect4',
  'tictactoe',
  'rps',
  'dice',
  '8ball',
  'coinflip',
  'confess',
  'birthday',
  'apply',
];

export function getDisabledCommands(): string[] {
  const raw = process.env.DISABLED_COMMANDS || '';
  return raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

export interface SelectionResult {
  selected: Command[];
  disabled: string[];
  dropped: string[];
  overLimit: boolean;
}

export function selectCommandsForRegistration(
  commands: Collection<string, Command>,
  limit = DISCORD_GLOBAL_COMMAND_LIMIT
): SelectionResult {
  const disabled = getDisabledCommands();
  const disabledSet = new Set(disabled);

  let pool = [...commands.values()].filter(
    (cmd) => !disabledSet.has(cmd.data.name.toLowerCase())
  );

  const dropped: string[] = [];
  const overLimit = pool.length > limit;

  if (overLimit) {
    const needed = pool.length - limit;
    const byName = new Map(pool.map((cmd) => [cmd.data.name.toLowerCase(), cmd]));

    for (const name of LOW_PRIORITY_COMMANDS) {
      if (dropped.length >= needed) break;
      if (byName.has(name)) {
        dropped.push(name);
        byName.delete(name);
      }
    }

    if (dropped.length < needed) {
      const remaining = [...byName.values()].sort((a, b) =>
        a.data.name.localeCompare(b.data.name)
      );
      while (dropped.length < needed && remaining.length > 0) {
        const victim = remaining.pop()!;
        dropped.push(victim.data.name.toLowerCase());
        byName.delete(victim.data.name.toLowerCase());
      }
    }

    pool = [...byName.values()];
  }

  return { selected: pool, disabled, dropped, overLimit };
}

export function reportSelection(result: SelectionResult, total: number): void {
  if (result.disabled.length > 0) {
    logger.info(
      `Vypnuté príkazy (DISABLED_COMMANDS): ${result.disabled.join(', ')}`
    );
  }

  if (!result.overLimit) return;

  logger.warn(
    `Príkazov je ${total}, Discord povolí najviac ${DISCORD_GLOBAL_COMMAND_LIMIT} globálnych. ` +
      `Neregistrujem tieto: ${result.dropped.join(', ')}`
  );
  logger.warn(
    'Ktoré príkazy vypadnú si vieš zvoliť sám: nastav DISABLED_COMMANDS v .env ' +
      '(napr. DISABLED_COMMANDS=nft,stock,crypto,wiki). Vypnuté príkazy sa naďalej ' +
      'dajú spustiť cez prefix, len nie sú v ponuke lomítka.'
  );
}
