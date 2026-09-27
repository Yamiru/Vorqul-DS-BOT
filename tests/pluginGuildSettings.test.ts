import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  validateManifest,
  resolveGuildSettings,
  sanitizeGuildSettings,
  channelReferences,
  effectiveDefault,
  effectiveMaxItems,
  type PluginSettingField,
  type GuildRecord
} from '../src/shared/pluginManifest';

const CHANNEL = '123456789012345678';
const OTHER = '223456789012345678';

const base = { name: 'demo', main: 'index.js' };
const globals = [
  { key: 'limit', type: 'number', label: 'Limit', default: 3, min: 1, max: 10 },
  { key: 'minEvery', type: 'number', label: 'Min', default: 5, min: 1, max: 60 },
  { key: 'everyDefault', type: 'number', label: 'Default', default: 15, min: 1, max: 60 },
  { key: 'loud', type: 'boolean', label: 'Loud', default: false }
];
const listField = {
  key: 'servers',
  type: 'list',
  label: 'Servers',
  maxItems: 5,
  maxItemsFrom: 'limit',
  itemTitleKey: 'name',
  fields: [
    { key: 'name', type: 'string', label: 'Name', default: '', required: true, maxLength: 20 },
    { key: 'port', type: 'number', label: 'Port', default: null, optional: true, min: 1, max: 65535 },
    { key: 'channel', type: 'channel', label: 'Channel', required: true },
    { key: 'voice', type: 'channel', label: 'Voice', kinds: ['voice', 'text'] },
    { key: 'every', type: 'number', label: 'Every', default: 10, min: 1, max: 1440, defaultFrom: 'everyDefault', minFrom: 'minEvery' },
    { key: 'loud', type: 'boolean', label: 'Loud', default: true, defaultFrom: 'loud' }
  ]
};

function fieldsOf(extra: Record<string, unknown> = {}): { guild: PluginSettingField[]; globals: Record<string, unknown> } {
  const result = validateManifest({ ...base, settings: globals, guildSettings: [{ ...listField, ...extra }] });
  if ('error' in result) throw new Error(result.error);
  return { guild: result.manifest.guildSettings, globals: { limit: 3, minEvery: 5, everyDefault: 15, loud: false } };
}

function reject(raw: Record<string, unknown>): string {
  const result = validateManifest({ ...base, ...raw });
  if (!('error' in result)) throw new Error('expected an error');
  return result.error;
}

describe('guildSettings manifest validation', () => {
  it('accepts lists, channels, optional numbers and references to plugin settings', () => {
    const { guild } = fieldsOf();
    expect(guild[0]).toMatchObject({ key: 'servers', type: 'list', maxItems: 5, itemTitleKey: 'name', default: [] });
    const inner = guild[0].fields!;
    expect(inner.find((f) => f.key === 'channel')).toMatchObject({ type: 'channel', kinds: ['text'], required: true, default: '' });
    expect(inner.find((f) => f.key === 'voice')?.kinds).toEqual(['voice', 'text']);
    expect(inner.find((f) => f.key === 'port')).toMatchObject({ optional: true, default: null });
  });

  it('only allows channel and list in guildSettings, never in global settings', () => {
    expect(reject({ settings: [{ key: 'c', type: 'channel', label: 'C' }] })).toContain('settings[0].type');
    expect(reject({ settings: [{ key: 'l', type: 'list', label: 'L', fields: [{ key: 'a', type: 'boolean', label: 'A', default: true }] }] })).toContain('settings[0].type');
  });

  it('does not allow a list inside a list or the reserved id key', () => {
    const nested = { key: 'l', type: 'list', label: 'L', fields: [{ key: 'x', type: 'list', label: 'X', fields: [{ key: 'a', type: 'boolean', label: 'A', default: true }] }] };
    expect(reject({ guildSettings: [nested] })).toContain('fields[0].type');
    const reserved = { key: 'l', type: 'list', label: 'L', fields: [{ key: 'id', type: 'boolean', label: 'A', default: true }] };
    expect(reject({ guildSettings: [reserved] })).toContain('reserved');
  });

  it('rejects broken lists and channels', () => {
    expect(reject({ guildSettings: [{ ...listField, fields: [] }] })).toContain('fields');
    expect(reject({ guildSettings: [{ ...listField, maxItems: 0 }], settings: globals })).toContain('maxItems');
    expect(reject({ guildSettings: [{ ...listField, itemTitleKey: 'port' }], settings: globals })).toContain('itemTitleKey');
    expect(reject({ guildSettings: [{ ...listField, default: [1] }], settings: globals })).toContain('empty list');
    expect(reject({ guildSettings: [{ key: 'c', type: 'channel', label: 'C', kinds: ['forum'] }] })).toContain('kinds');
    expect(reject({ guildSettings: [{ key: 'c', type: 'channel', label: 'C', default: '123' }] })).toContain('empty');
  });

  it('checks that *From references point at matching plugin settings', () => {
    expect(reject({ settings: globals, guildSettings: [{ ...listField, maxItemsFrom: 'missing' }] })).toContain('maxItemsFrom');
    expect(reject({ settings: globals, guildSettings: [{ ...listField, maxItemsFrom: 'loud' }] })).toContain('maxItemsFrom');
    expect(reject({ guildSettings: [listField] })).toContain('points at');
    expect(reject({ guildSettings: [{ key: 'flag', type: 'boolean', label: 'F', default: true, defaultFrom: 'nope' }], settings: globals })).toContain('defaultFrom');
  });

  it('validates the bundled plugins', () => {
    const root = path.join(__dirname, '..', 'plugins');
    for (const folder of fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, folder.name, 'manifest.json'), 'utf-8'));
      const result = validateManifest(manifest);
      expect(result, `${folder.name}: ${'error' in result ? result.error : ''}`).toHaveProperty('ok', true);
      if ('manifest' in result) expect(result.manifest.name).toBe(folder.name);
    }
  });
});

describe('effective defaults and limits', () => {
  const { guild, globals: g } = fieldsOf();
  const list = guild[0];
  const every = list.fields!.find((f) => f.key === 'every')!;
  const loud = list.fields!.find((f) => f.key === 'loud')!;

  it('takes defaults from plugin settings when they fit', () => {
    expect(effectiveDefault(every, g)).toBe(15);
    expect(effectiveDefault(every, { ...g, everyDefault: 2 })).toBe(10);
    expect(effectiveDefault(loud, g)).toBe(false);
    expect(effectiveDefault(loud, {})).toBe(true);
  });

  it('limits the number of items by the referenced setting', () => {
    expect(effectiveMaxItems(list, g)).toBe(3);
    expect(effectiveMaxItems(list, { limit: 50 })).toBe(5);
    expect(effectiveMaxItems(list, {})).toBe(5);
  });
});

describe('sanitizeGuildSettings', () => {
  const { guild, globals: g } = fieldsOf();
  const item = (over: Record<string, unknown> = {}) => ({ name: 'Survival', port: 25566, channel: CHANNEL, every: 10, ...over });

  it('accepts valid items, assigns ids and fills defaults', () => {
    const { values, errors } = sanitizeGuildSettings(guild, { servers: [item(), item({ name: 'Creative', port: '', voice: OTHER })] }, {}, g);
    expect(errors).toEqual({});
    const servers = values.servers as GuildRecord[];
    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({ name: 'Survival', port: 25566, channel: CHANNEL, voice: '', every: 10, loud: false });
    expect(servers[1]).toMatchObject({ name: 'Creative', port: null, voice: OTHER });
    expect(servers[0].id).toMatch(/^[a-z0-9]{6,24}$/);
    expect(servers[0].id).not.toBe(servers[1].id);
  });

  it('keeps existing ids and replaces duplicated or invalid ones', () => {
    const { values } = sanitizeGuildSettings(guild, { servers: [item({ id: 'abcdef12' }), item({ id: 'abcdef12' }), item({ id: '../evil' })] }, {}, g);
    const ids = (values.servers as GuildRecord[]).map((s) => s.id as string);
    expect(ids[0]).toBe('abcdef12');
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => /^[a-z0-9]{6,24}$/.test(id))).toBe(true);
  });

  it('reports errors by path and keeps the previous values', () => {
    const current = { servers: [{ id: 'keepme12', name: 'Old', port: null, channel: CHANNEL, voice: '', every: 10, loud: false }] };
    const { values, errors } = sanitizeGuildSettings(
      guild,
      { servers: [item({ name: '' }), item({ port: 70000 }), item({ channel: '' }), item({ channel: 'abc' }), 'oops'] },
      current,
      { ...g, limit: 10 }
    );
    expect(errors).toMatchObject({
      'servers[0].name': 'required',
      'servers[1].port': 'range',
      'servers[2].channel': 'required',
      'servers[3].channel': 'channel',
      'servers[4]': 'item'
    });
    expect(Array.isArray(values.servers)).toBe(true);
  });

  it('enforces the item limit that comes from a plugin setting', () => {
    const five = Array.from({ length: 4 }, (_, i) => item({ name: `S${i}` }));
    const { errors } = sanitizeGuildSettings(guild, { servers: five }, {}, g);
    expect(errors).toEqual({ servers: 'too_many' });
    expect(sanitizeGuildSettings(guild, { servers: five }, {}, { ...g, limit: 4 }).errors).toEqual({});
  });

  it('rejects a minimum interval that comes from a plugin setting', () => {
    const { errors } = sanitizeGuildSettings(guild, { servers: [item({ every: 4 })] }, {}, g);
    expect(errors).toEqual({ 'servers[0].every': 'range' });
  });

  it('rejects non-lists and leaves omitted fields alone', () => {
    expect(sanitizeGuildSettings(guild, { servers: 'nope' }, {}, g).errors).toEqual({ servers: 'list' });
    const current = { servers: [{ id: 'keepme12', name: 'Old', port: null, channel: CHANNEL, voice: '', every: 10, loud: false }] };
    expect(sanitizeGuildSettings(guild, {}, current, g).values).toEqual(current);
  });
});

describe('resolveGuildSettings', () => {
  const { guild, globals: g } = fieldsOf();

  it('fills defaults and drops items without a valid id', () => {
    const stored = { servers: [{ id: 'abcdef12', name: 'A', channel: CHANNEL }, { name: 'no id' }, { id: '!!', name: 'bad id' }, 'junk'] };
    const values = resolveGuildSettings(guild, stored, g);
    expect(values.servers).toEqual([
      { id: 'abcdef12', name: 'A', port: null, channel: CHANNEL, voice: '', every: 15, loud: false }
    ]);
  });

  it('caps the list at the current limit and survives garbage', () => {
    const many = { servers: Array.from({ length: 10 }, (_, i) => ({ id: `id${String(i).padStart(6, '0')}`, name: `S${i}`, channel: CHANNEL })) };
    expect((resolveGuildSettings(guild, many, g).servers as unknown[]).length).toBe(3);
    expect(resolveGuildSettings(guild, null, g)).toEqual({ servers: [] });
    expect(resolveGuildSettings(guild, { servers: 'x' }, g)).toEqual({ servers: [] });
  });

  it('ignores stored values that are no longer valid', () => {
    const stored = { servers: [{ id: 'abcdef12', name: 'A', channel: 'not-a-channel', port: 'x', every: 99999 }] };
    const [only] = resolveGuildSettings(guild, stored, g).servers as GuildRecord[];
    expect(only).toMatchObject({ channel: '', port: null, every: 15 });
  });
});

describe('channelReferences', () => {
  it('lists every channel id with its path and allowed kinds', () => {
    const { guild, globals: g } = fieldsOf();
    const { values } = sanitizeGuildSettings(guild, { servers: [{ name: 'A', channel: CHANNEL, voice: OTHER }, { name: 'B', channel: CHANNEL }] }, {}, g);
    expect(channelReferences(guild, values)).toEqual([
      { path: 'servers[0].channel', id: CHANNEL, kinds: ['text'] },
      { path: 'servers[0].voice', id: OTHER, kinds: ['voice', 'text'] },
      { path: 'servers[1].channel', id: CHANNEL, kinds: ['text'] }
    ]);
  });
});
