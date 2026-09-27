/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import ms from 'ms';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

const DANGEROUS_ROLE_PERMISSIONS: Record<string, bigint> = {
  Administrator: PermissionFlagsBits.Administrator,
  'Ban Members': PermissionFlagsBits.BanMembers,
  'Kick Members': PermissionFlagsBits.KickMembers,
  'Manage Guild': PermissionFlagsBits.ManageGuild,
  'Manage Roles': PermissionFlagsBits.ManageRoles,
  'Manage Channels': PermissionFlagsBits.ManageChannels,
  'Manage Webhooks': PermissionFlagsBits.ManageWebhooks,
  'Manage Messages': PermissionFlagsBits.ManageMessages,
  'Manage Guild Expressions': PermissionFlagsBits.ManageGuildExpressions,
  'Moderate Members': PermissionFlagsBits.ModerateMembers,
  'Mention Everyone': PermissionFlagsBits.MentionEveryone,
};

export function getDangerousRolePermissions(permissions: PermissionsBitField | bigint | string): string[] {
  const bits = new PermissionsBitField(permissions as any);
  return Object.entries(DANGEROUS_ROLE_PERMISSIONS)
    .filter(([, flag]) => bits.has(flag))
    .map(([name]) => name);
}

export function parseTime(input: string): number | null {
  const parsed = ms(input);
  return parsed !== undefined ? parsed : null;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([*_`~|\\])/g, '\\$1');
}

export function progressBar(current: number, total: number, length = 10): string {
  const progress = Math.round((current / total) * length);
  const empty = length - progress;
  return '█'.repeat(progress) + '░'.repeat(empty);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
  return date.toLocaleDateString();
}

export const discordTimestamp = {
  short: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:t>`,
  long: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:T>`,
  shortDate: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:d>`,
  longDate: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:D>`,
  shortDateTime: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:f>`,
  longDateTime: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`,
  relative: (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`
};
