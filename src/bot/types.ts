/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Message,
  PermissionResolvable,
  Client,
  ClientEvents
} from 'discord.js';
import type { EmbedHelper } from '../utils/embedHelper.js';
import type { PluginSettingField, SettingValue, GuildValues } from '../shared/pluginManifest.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  category: string;
  cooldown?: number;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  permissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  category: string;
  usage?: string;
  cooldown?: number;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  permissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  execute: (message: Message, args: string[]) => Promise<void>;
}

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
}

export interface Plugin {
  name: string;
  version: string;
  author: string;
  description: string;
  commands?: Command[];
  events?: Event<any>[];
  onLoad?: (ctx: PluginContext) => void | Promise<void>;
  onUnload?: (ctx: PluginContext) => void | Promise<void>;
}

export interface PluginManifest {
  name: string;
  version: string;
  author: string;
  description: string;
  main: string;
  enabled?: boolean;
  settings?: PluginSettingField[];
  guildSettings?: PluginSettingField[];
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: unknown, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface PluginContext {
  client: Client;
  embed: typeof EmbedHelper;
  logger: PluginLogger;
  t(key: string, guildId?: string, vars?: Record<string, string>): string;
  dataDir: string;
  readData<T>(file: string, fallback: T): T;
  writeData(file: string, value: unknown): void;
  getSettings<T extends Record<string, SettingValue> = Record<string, SettingValue>>(): T;
  getGuildSettings(guildId: string): GuildValues;
  listGuildSettings(): Record<string, GuildValues>;
  saveGuildSettings(guildId: string, values: Record<string, unknown>): GuildValues;
}

export interface CooldownData {
  userId: string;
  command: string;
  expiresAt: number;
}

export interface AutomodAction {
  type: 'delete' | 'warn' | 'mute' | 'kick' | 'ban' | 'timeout';
  duration?: number;
  reason?: string;
}

export interface LevelUpReward {
  level: number;
  roleId: string;
  removeOnLevelDown?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId?: string;
  maxQuantity?: number;
  available: boolean;
}

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  last_updated: string;
}

export interface EmbedTemplateData {
  id: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: boolean;
  author?: { name: string; iconUrl?: string; url?: string };
}
