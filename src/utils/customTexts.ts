/*!
 * Vorqul DS BOT - Custom Texts
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { getGuildRecord, invalidateGuildCache } from './guildCache.js';

function readTexts(guildId: string): Record<string, string> {
  const record = getGuildRecord(guildId);
  const raw = record?.custom_texts;
  if (!raw || typeof raw !== 'object') return {};

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim().length > 0) clean[key] = value;
  }
  return clean;
}

export function getCustomText(guildId: string, key: string): string | undefined {
  return readTexts(guildId)[key];
}

export function getCustomTexts(guildId: string): Record<string, string> {
  return readTexts(guildId);
}

export function invalidateCustomTexts(): void {
  invalidateGuildCache();
}

export const COMMON_TEXT_KEYS: { key: string; group: string; hint: string }[] = [
  { key: 'common.noPermission', group: 'customText.group.basic', hint: 'customText.noPermission' },
  { key: 'common.botNoPermission', group: 'customText.group.basic', hint: 'customText.botNoPermission' },
  { key: 'common.ownerOnly', group: 'customText.group.basic', hint: 'customText.ownerOnly' },
  { key: 'common.guildOnly', group: 'customText.group.basic', hint: 'customText.guildOnly' },
  { key: 'common.cooldown', group: 'customText.group.basic', hint: 'customText.cooldown' },
  { key: 'common.wrongChannel', group: 'customText.group.basic', hint: 'customText.wrongChannel' },
  { key: 'common.unknownError', group: 'customText.group.basic', hint: 'customText.unknownError' },
  { key: 'common.invalidUser', group: 'customText.group.basic', hint: 'customText.invalidUser' },
  { key: 'common.invalidChannel', group: 'customText.group.basic', hint: 'customText.invalidChannel' },
  { key: 'common.invalidRole', group: 'customText.group.basic', hint: 'customText.invalidRole' },
];

export function applyVariables(text: string, variables: Record<string, string>): string {
  let output = text;
  for (const [name, value] of Object.entries(variables)) {
    output = output.replace(new RegExp(`\\{${name}\\}`, 'g'), () => value);
  }
  return output;
}
