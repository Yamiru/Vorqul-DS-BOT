/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

export type SettingType = 'boolean' | 'number' | 'string' | 'select' | 'channel' | 'list';
export type ChannelKind = 'text' | 'voice';
export type Localized = string | Record<string, string>;
export type SettingValue = boolean | number | string;
export type GuildRecord = Record<string, boolean | number | string | null>;
export type FieldValue = boolean | number | string | null | GuildRecord[];
export type GuildValues = Record<string, FieldValue>;

export interface PluginSettingOption {
  value: string;
  label: Localized;
}

export interface PluginSettingField {
  key: string;
  type: SettingType;
  label: Localized;
  description?: Localized;
  default: FieldValue;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  options?: PluginSettingOption[];
  optional?: boolean;
  required?: boolean;
  kinds?: ChannelKind[];
  fields?: PluginSettingField[];
  maxItems?: number;
  itemTitleKey?: string;
  defaultFrom?: string;
  minFrom?: string;
  maxItemsFrom?: string;
}

export interface ValidManifest {
  name: string;
  version: string;
  author: string;
  description: string;
  main: string;
  enabled: boolean;
  homepage?: string;
  github?: string;
  license?: string;
  settings: PluginSettingField[];
  guildSettings: PluginSettingField[];
}

export type ManifestResult = { ok: true; manifest: ValidManifest } | { ok: false; error: string };

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const ID_PATTERN = /^[a-z0-9]{6,24}$/;
const CHANNEL_PATTERN = /^\d{15,25}$/;
const MAX_FIELDS = 30;
const MAX_OPTIONS = 50;
const MAX_ITEM_FIELDS = 20;
const MAX_LIST_ITEMS = 100;
const DEFAULT_LIST_ITEMS = 25;
const DEFAULT_STRING_MAX = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKey(source: Record<string, unknown>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, name);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 300) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function localizedOk(value: unknown): value is Localized {
  if (typeof value === 'string') return value.trim().length > 0 && value.length <= 300;
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.length <= 20 &&
    entries.every(([k, v]) => /^[a-z]{2}$/.test(k) && typeof v === 'string' && v.length > 0 && v.length <= 300)
  );
}

export function localize(value: Localized | undefined, language: string): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[language] ?? value.en ?? Object.values(value)[0] ?? '';
}

function mainOk(main: unknown): main is string {
  if (typeof main !== 'string' || main.length === 0 || main.length > 200) return false;
  if (main.includes('\\') || main.includes('\0') || main.startsWith('/') || /^[a-zA-Z]:/.test(main)) return false;
  if (main.split('/').some((part) => part === '..' || part === '')) return false;
  return main.endsWith('.js') || main.endsWith('.mjs');
}

type Scope = 'global' | 'guild' | 'item';

function allowedTypes(scope: Scope): SettingType[] {
  if (scope === 'global') return ['boolean', 'number', 'string', 'select'];
  if (scope === 'guild') return ['boolean', 'number', 'string', 'select', 'channel', 'list'];
  return ['boolean', 'number', 'string', 'select', 'channel'];
}

function validateField(raw: unknown, where: string, scope: Scope): { field?: PluginSettingField; error?: string } {
  if (!isRecord(raw)) return { error: `${where} must be an object` };
  const { key, type } = raw;
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) return { error: `${where}.key is invalid` };
  if (scope === 'item' && key === 'id') return { error: `${where}.key "id" is reserved` };
  if (typeof type !== 'string' || !allowedTypes(scope).includes(type as SettingType)) {
    return { error: `${where}.type must be one of ${allowedTypes(scope).join(', ')}` };
  }
  if (!localizedOk(raw.label)) return { error: `${where}.label is missing or too long` };
  if (raw.description !== undefined && !localizedOk(raw.description)) {
    return { error: `${where}.description is invalid` };
  }

  const field: PluginSettingField = { key, type: type as SettingType, label: raw.label, default: null };
  if (raw.description !== undefined) field.description = raw.description as Localized;
  if (raw.optional === true) field.optional = true;
  if (raw.required === true) field.required = true;

  for (const name of ['defaultFrom', 'minFrom', 'maxItemsFrom'] as const) {
    const value = raw[name];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !KEY_PATTERN.test(value)) return { error: `${where}.${name} must be a setting key` };
    field[name] = value;
  }

  switch (type) {
    case 'boolean':
      if (typeof raw.default !== 'boolean') return { error: `${where}.default must be true or false` };
      field.default = raw.default;
      break;
    case 'number': {
      const nullable = field.optional === true && raw.default === null;
      if (!nullable && (typeof raw.default !== 'number' || !Number.isFinite(raw.default))) {
        return { error: `${where}.default must be a number` };
      }
      for (const bound of ['min', 'max', 'step'] as const) {
        const value = raw[bound];
        if (value === undefined) continue;
        if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${where}.${bound} must be a number` };
        field[bound] = value;
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        return { error: `${where}.min is above max` };
      }
      if (!nullable) {
        const n = raw.default as number;
        if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
          return { error: `${where}.default is outside min/max` };
        }
      }
      field.default = raw.default as number | null;
      break;
    }
    case 'string': {
      if (typeof raw.default !== 'string') return { error: `${where}.default must be a string` };
      const maxLength = raw.maxLength === undefined ? DEFAULT_STRING_MAX : raw.maxLength;
      if (typeof maxLength !== 'number' || !Number.isInteger(maxLength) || maxLength < 1 || maxLength > 2000) {
        return { error: `${where}.maxLength must be 1-2000` };
      }
      field.maxLength = maxLength;
      if (raw.default.length > maxLength) return { error: `${where}.default is longer than maxLength` };
      field.default = raw.default;
      break;
    }
    case 'select': {
      if (!Array.isArray(raw.options) || raw.options.length === 0 || raw.options.length > MAX_OPTIONS) {
        return { error: `${where}.options must list 1-${MAX_OPTIONS} choices` };
      }
      const options: PluginSettingOption[] = [];
      for (const option of raw.options) {
        if (!isRecord(option) || typeof option.value !== 'string' || option.value.length === 0 || option.value.length > 100 || !localizedOk(option.label)) {
          return { error: `${where}.options has an invalid choice` };
        }
        options.push({ value: option.value, label: option.label });
      }
      if (new Set(options.map((o) => o.value)).size !== options.length) return { error: `${where}.options repeats a value` };
      if (typeof raw.default !== 'string' || !options.some((o) => o.value === raw.default)) {
        return { error: `${where}.default must be one of the options` };
      }
      field.options = options;
      field.default = raw.default;
      break;
    }
    case 'channel': {
      const kinds = raw.kinds === undefined ? ['text'] : raw.kinds;
      if (!Array.isArray(kinds) || kinds.length === 0 || !kinds.every((k) => k === 'text' || k === 'voice')) {
        return { error: `${where}.kinds must list text and/or voice` };
      }
      field.kinds = Array.from(new Set(kinds)) as ChannelKind[];
      if (raw.default !== undefined && raw.default !== '') return { error: `${where}.default must be empty for a channel` };
      field.default = '';
      break;
    }
    case 'list': {
      if (!Array.isArray(raw.fields) || raw.fields.length === 0 || raw.fields.length > MAX_ITEM_FIELDS) {
        return { error: `${where}.fields must list 1-${MAX_ITEM_FIELDS} fields` };
      }
      const inner: PluginSettingField[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < raw.fields.length; i++) {
        const result = validateField(raw.fields[i], `${where}.fields[${i}]`, 'item');
        if (result.error || !result.field) return { error: result.error || 'invalid field' };
        if (seen.has(result.field.key)) return { error: `${where}.fields[${i}].key "${result.field.key}" is repeated` };
        seen.add(result.field.key);
        inner.push(result.field);
      }
      field.fields = inner;
      const maxItems = raw.maxItems === undefined ? DEFAULT_LIST_ITEMS : raw.maxItems;
      if (typeof maxItems !== 'number' || !Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_LIST_ITEMS) {
        return { error: `${where}.maxItems must be 1-${MAX_LIST_ITEMS}` };
      }
      field.maxItems = maxItems;
      if (raw.itemTitleKey !== undefined) {
        const titleField = inner.find((f) => f.key === raw.itemTitleKey);
        if (!titleField || titleField.type !== 'string') return { error: `${where}.itemTitleKey must name a string field` };
        field.itemTitleKey = titleField.key;
      }
      if (raw.default !== undefined && !(Array.isArray(raw.default) && raw.default.length === 0)) {
        return { error: `${where}.default must be an empty list` };
      }
      field.default = [];
      break;
    }
  }
  return { field };
}

function validateFieldList(raw: unknown, name: string, scope: Scope): { fields?: PluginSettingField[]; error?: string } {
  if (raw === undefined) return { fields: [] };
  if (!Array.isArray(raw) || raw.length > MAX_FIELDS) {
    return { error: `"${name}" must be a list of at most ${MAX_FIELDS} fields` };
  }
  const fields: PluginSettingField[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const { field, error } = validateField(raw[i], `${name}[${i}]`, scope);
    if (error || !field) return { error: error || 'invalid setting' };
    if (seen.has(field.key)) return { error: `${name}[${i}].key "${field.key}" is repeated` };
    seen.add(field.key);
    fields.push(field);
  }
  return { fields };
}

function checkReferences(guildFields: PluginSettingField[], globals: PluginSettingField[]): string | undefined {
  const byKey = new Map(globals.map((f) => [f.key, f]));
  const check = (field: PluginSettingField, where: string): string | undefined => {
    const refs: [string | undefined, string, SettingType][] = [
      [field.defaultFrom, 'defaultFrom', field.type === 'boolean' ? 'boolean' : 'number'],
      [field.minFrom, 'minFrom', 'number'],
      [field.maxItemsFrom, 'maxItemsFrom', 'number']
    ];
    for (const [target, name, type] of refs) {
      if (!target) continue;
      const referenced = byKey.get(target);
      if (!referenced || referenced.type !== type) {
        return `${where}.${name} points at "${target}", which is not a matching plugin setting`;
      }
    }
    for (const inner of field.fields ?? []) {
      const problem = check(inner, `${where}.${inner.key}`);
      if (problem) return problem;
    }
    return undefined;
  };
  for (const field of guildFields) {
    const problem = check(field, `guildSettings.${field.key}`);
    if (problem) return problem;
  }
  return undefined;
}

export function validateManifest(raw: unknown): ManifestResult {
  if (!isRecord(raw)) return { ok: false, error: 'manifest.json must contain a JSON object' };
  if (typeof raw.name !== 'string' || !PLUGIN_NAME_PATTERN.test(raw.name)) {
    return { ok: false, error: '"name" must be 2-32 lowercase letters, digits, _ or -' };
  }
  if (!mainOk(raw.main)) {
    return { ok: false, error: '"main" must be a .js or .mjs file path inside the plugin folder' };
  }

  const globals = validateFieldList(raw.settings, 'settings', 'global');
  if (globals.error || !globals.fields) return { ok: false, error: globals.error || 'invalid settings' };
  const guild = validateFieldList(raw.guildSettings, 'guildSettings', 'guild');
  if (guild.error || !guild.fields) return { ok: false, error: guild.error || 'invalid guildSettings' };
  const referenceProblem = checkReferences(guild.fields, globals.fields);
  if (referenceProblem) return { ok: false, error: referenceProblem };

  const manifest: ValidManifest = {
    name: raw.name,
    version: text(raw.version, 32) || '0.0.0',
    author: text(raw.author, 100),
    description: text(raw.description, 500),
    main: raw.main,
    enabled: raw.enabled !== false,
    settings: globals.fields,
    guildSettings: guild.fields
  };
  const homepage = safeUrl(raw.homepage);
  const github = safeUrl(raw.github);
  const license = text(raw.license, 100);
  if (homepage) manifest.homepage = homepage;
  if (github) manifest.github = github;
  if (license) manifest.license = license;
  return { ok: true, manifest };
}

type Coerced = { value: FieldValue } | { error: string };

function boundsFor(field: PluginSettingField, globals: Record<string, unknown>): { min?: number; max?: number } {
  let min = field.min;
  const from = field.minFrom ? globals[field.minFrom] : undefined;
  if (typeof from === 'number' && Number.isFinite(from)) min = min === undefined ? from : Math.max(min, from);
  return { min, max: field.max };
}

export function effectiveDefault(field: PluginSettingField, globals: Record<string, unknown> = {}): FieldValue {
  if (field.defaultFrom) {
    const from = globals[field.defaultFrom];
    if (field.type === 'boolean' && typeof from === 'boolean') return from;
    if (field.type === 'number' && typeof from === 'number' && Number.isFinite(from)) {
      const { min, max } = boundsFor(field, globals);
      if ((min === undefined || from >= min) && (max === undefined || from <= max)) return from;
    }
  }
  return field.default;
}

export function effectiveMaxItems(field: PluginSettingField, globals: Record<string, unknown> = {}): number {
  let limit = field.maxItems ?? DEFAULT_LIST_ITEMS;
  const from = field.maxItemsFrom ? globals[field.maxItemsFrom] : undefined;
  if (typeof from === 'number' && Number.isFinite(from)) limit = Math.max(0, Math.min(limit, Math.floor(from)));
  return limit;
}

export function effectiveMin(field: PluginSettingField, globals: Record<string, unknown> = {}): number | undefined {
  return boundsFor(field, globals).min;
}

function coerce(field: PluginSettingField, value: unknown, globals: Record<string, unknown> = {}): Coerced {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? { value } : { error: 'boolean' };
    case 'number': {
      if (field.optional && (value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))) {
        return { value: null };
      }
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) return { error: 'number' };
      const { min, max } = boundsFor(field, globals);
      if ((min !== undefined && n < min) || (max !== undefined && n > max)) return { error: 'range' };
      return { value: n };
    }
    case 'string': {
      if (typeof value !== 'string') return { error: 'string' };
      if (value.length > (field.maxLength ?? DEFAULT_STRING_MAX)) return { error: 'length' };
      if (field.required && value.trim() === '') return { error: 'required' };
      return { value };
    }
    case 'select':
      return typeof value === 'string' && (field.options ?? []).some((o) => o.value === value)
        ? { value }
        : { error: 'option' };
    case 'channel': {
      if (value === null || value === undefined || value === '') {
        return field.required ? { error: 'required' } : { value: '' };
      }
      return typeof value === 'string' && CHANNEL_PATTERN.test(value) ? { value } : { error: 'channel' };
    }
    default:
      return { error: 'unsupported' };
  }
}

export function resolveSettings(fields: PluginSettingField[], stored: unknown): Record<string, SettingValue> {
  const source = isRecord(stored) ? stored : {};
  const out: Record<string, SettingValue> = {};
  for (const field of fields) {
    const result = hasKey(source, field.key) ? coerce(field, source[field.key]) : { error: 'missing' };
    out[field.key] = 'value' in result ? (result.value as SettingValue) : (field.default as SettingValue);
  }
  return out;
}

export function sanitizeSettings(
  fields: PluginSettingField[],
  input: unknown,
  current: Record<string, SettingValue> = {}
): { values: Record<string, SettingValue>; errors: Record<string, string> } {
  const source = isRecord(input) ? input : {};
  const values: Record<string, SettingValue> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!hasKey(source, field.key)) {
      values[field.key] = current[field.key] ?? (field.default as SettingValue);
      continue;
    }
    const result = coerce(field, source[field.key]);
    if ('value' in result) values[field.key] = result.value as SettingValue;
    else {
      errors[field.key] = result.error;
      values[field.key] = current[field.key] ?? (field.default as SettingValue);
    }
  }
  return { values, errors };
}

function newItemId(used: Set<string>): string {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    if (ID_PATTERN.test(id) && !used.has(id)) {
      used.add(id);
      return id;
    }
  }
}

function resolveRecord(fields: PluginSettingField[], stored: unknown, globals: Record<string, unknown>): GuildRecord {
  const source = isRecord(stored) ? stored : {};
  const out: GuildRecord = {};
  for (const field of fields) {
    const result = hasKey(source, field.key) ? coerce(field, source[field.key], globals) : { error: 'missing' };
    out[field.key] = ('value' in result ? result.value : effectiveDefault(field, globals)) as GuildRecord[string];
  }
  return out;
}

export function resolveGuildSettings(
  fields: PluginSettingField[],
  stored: unknown,
  globals: Record<string, unknown> = {}
): GuildValues {
  const source = isRecord(stored) ? stored : {};
  const out: GuildValues = {};
  for (const field of fields) {
    if (field.type !== 'list') {
      const result = hasKey(source, field.key) ? coerce(field, source[field.key], globals) : { error: 'missing' };
      out[field.key] = 'value' in result ? result.value : effectiveDefault(field, globals);
      continue;
    }
    const raw = Array.isArray(source[field.key]) ? (source[field.key] as unknown[]) : [];
    const items: GuildRecord[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
      if (items.length >= effectiveMaxItems(field, globals)) break;
      if (!isRecord(entry) || typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id) || seen.has(entry.id)) continue;
      seen.add(entry.id);
      items.push({ id: entry.id, ...resolveRecord(field.fields ?? [], entry, globals) });
    }
    out[field.key] = items;
  }
  return out;
}

export function sanitizeGuildSettings(
  fields: PluginSettingField[],
  input: unknown,
  current: GuildValues = {},
  globals: Record<string, unknown> = {}
): { values: GuildValues; errors: Record<string, string> } {
  const source = isRecord(input) ? input : {};
  const values: GuildValues = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const fallback = current[field.key] ?? effectiveDefault(field, globals);
    if (!hasKey(source, field.key)) {
      values[field.key] = fallback;
      continue;
    }

    if (field.type !== 'list') {
      const result = coerce(field, source[field.key], globals);
      if ('value' in result) values[field.key] = result.value;
      else {
        errors[field.key] = result.error;
        values[field.key] = fallback;
      }
      continue;
    }

    const raw = source[field.key];
    if (!Array.isArray(raw)) {
      errors[field.key] = 'list';
      values[field.key] = fallback;
      continue;
    }
    if (raw.length > effectiveMaxItems(field, globals)) {
      errors[field.key] = 'too_many';
      values[field.key] = fallback;
      continue;
    }

    const used = new Set<string>();
    const items: GuildRecord[] = [];
    raw.forEach((entry, index) => {
      const where = `${field.key}[${index}]`;
      if (!isRecord(entry)) {
        errors[where] = 'item';
        return;
      }
      const record: GuildRecord = {};
      for (const inner of field.fields ?? []) {
        const result = hasKey(entry, inner.key)
          ? coerce(inner, entry[inner.key], globals)
          : { value: effectiveDefault(inner, globals) };
        if ('value' in result) record[inner.key] = result.value as GuildRecord[string];
        else {
          errors[`${where}.${inner.key}`] = result.error;
          record[inner.key] = effectiveDefault(inner, globals) as GuildRecord[string];
        }
      }
      const givenId = typeof entry.id === 'string' && ID_PATTERN.test(entry.id) && !used.has(entry.id) ? entry.id : '';
      if (givenId) used.add(givenId);
      items.push({ id: givenId || newItemId(used), ...record });
    });
    values[field.key] = items;
  }
  return { values, errors };
}

export function channelReferences(
  fields: PluginSettingField[],
  values: GuildValues
): { path: string; id: string; kinds: ChannelKind[] }[] {
  const out: { path: string; id: string; kinds: ChannelKind[] }[] = [];
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'channel' && typeof value === 'string' && value) {
      out.push({ path: field.key, id: value, kinds: field.kinds ?? ['text'] });
    }
    if (field.type === 'list' && Array.isArray(value)) {
      value.forEach((item, index) => {
        for (const inner of field.fields ?? []) {
          const id = item[inner.key];
          if (inner.type === 'channel' && typeof id === 'string' && id) {
            out.push({ path: `${field.key}[${index}].${inner.key}`, id, kinds: inner.kinds ?? ['text'] });
          }
        }
      });
    }
  }
  return out;
}
