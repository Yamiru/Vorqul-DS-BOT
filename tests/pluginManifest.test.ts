import { describe, expect, it } from 'vitest';
import {
  validateManifest,
  resolveSettings,
  sanitizeSettings,
  localize,
  type PluginSettingField
} from '../src/shared/pluginManifest';

const base = { name: 'my_plugin', version: '1.2.3', author: 'Me', description: 'Does things', main: 'index.js' };

function ok(raw: unknown) {
  const result = validateManifest(raw);
  if ('error' in result) throw new Error(result.error);
  return result.manifest;
}

function error(raw: unknown): string {
  const result = validateManifest(raw);
  if (!('error' in result)) throw new Error('expected an error');
  return result.error;
}

describe('validateManifest', () => {
  it('accepts a minimal manifest and applies defaults', () => {
    const manifest = ok({ name: 'ab', main: 'index.mjs' });
    expect(manifest.version).toBe('0.0.0');
    expect(manifest.enabled).toBe(true);
    expect(manifest.settings).toEqual([]);
  });

  it('respects enabled:false', () => {
    expect(ok({ ...base, enabled: false }).enabled).toBe(false);
  });

  it('rejects bad names', () => {
    for (const name of ['A', 'UPPER', 'a', '-bad', 'has space', 'x'.repeat(33), '../evil', 5, undefined]) {
      expect(() => ok({ ...base, name })).toThrow();
    }
  });

  it('rejects unsafe or non-JavaScript main files', () => {
    for (const main of ['index.ts', '../index.js', '/abs/index.js', 'a\\b.js', 'C:/x.js', 'dir//x.js', '', 'noext', 42]) {
      expect(() => ok({ ...base, main })).toThrow();
    }
    expect(ok({ ...base, main: 'dist/index.mjs' }).main).toBe('dist/index.mjs');
  });

  it('only keeps http(s) links', () => {
    const manifest = ok({ ...base, github: 'javascript:alert(1)', homepage: 'https://vorqul.com' });
    expect(manifest.github).toBeUndefined();
    expect(manifest.homepage).toBe('https://vorqul.com/');
  });

  it('validates setting fields', () => {
    const settings: PluginSettingField[] = ok({
      ...base,
      settings: [
        { key: 'on', type: 'boolean', label: 'On', default: true },
        { key: 'count', type: 'number', label: { en: 'Count', sk: 'Počet' }, default: 5, min: 1, max: 10 },
        { key: 'title', type: 'string', label: 'Title', default: 'hi', maxLength: 10 },
        { key: 'mode', type: 'select', label: 'Mode', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }
      ]
    }).settings;
    expect(settings.map((f) => f.key)).toEqual(['on', 'count', 'title', 'mode']);
  });

  it('rejects invalid setting fields', () => {
    const bad = [
      { key: '1bad', type: 'boolean', label: 'x', default: true },
      { key: 'a', type: 'color', label: 'x', default: 'red' },
      { key: 'a', type: 'boolean', label: '', default: true },
      { key: 'a', type: 'boolean', label: 'x', default: 'yes' },
      { key: 'a', type: 'number', label: 'x', default: 50, min: 1, max: 10 },
      { key: 'a', type: 'number', label: 'x', default: 1, min: 10, max: 1 },
      { key: 'a', type: 'string', label: 'x', default: 'toolong', maxLength: 3 },
      { key: 'a', type: 'select', label: 'x', default: 'z', options: [{ value: 'a', label: 'A' }] },
      { key: 'a', type: 'select', label: 'x', default: 'a', options: [] },
      { key: 'a', type: 'select', label: 'x', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }] }
    ];
    for (const field of bad) expect(() => ok({ ...base, settings: [field] })).toThrow();
    expect(
      error({
        ...base,
        settings: [
          { key: 'a', type: 'boolean', label: 'x', default: true },
          { key: 'a', type: 'boolean', label: 'y', default: false }
        ]
      })
    ).toContain('repeated');
    expect(() => ok({ ...base, settings: 'nope' })).toThrow();
    expect(() =>
      ok({ ...base, settings: Array.from({ length: 31 }, (_, i) => ({ key: `k${i}`, type: 'boolean', label: 'x', default: true })) })
    ).toThrow();
  });
});

describe('settings values', () => {
  const fields = ok({
    ...base,
    settings: [
      { key: 'on', type: 'boolean', label: 'On', default: true },
      { key: 'count', type: 'number', label: 'Count', default: 5, min: 1, max: 10 },
      { key: 'title', type: 'string', label: 'Title', default: 'hi', maxLength: 5 },
      { key: 'mode', type: 'select', label: 'Mode', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }
    ]
  }).settings;

  it('resolves defaults for missing or invalid stored values', () => {
    expect(resolveSettings(fields, {})).toEqual({ on: true, count: 5, title: 'hi', mode: 'a' });
    expect(resolveSettings(fields, null)).toEqual({ on: true, count: 5, title: 'hi', mode: 'a' });
    expect(resolveSettings(fields, { on: 'yes', count: 99, title: 'way too long', mode: 'zzz', extra: 1 })).toEqual({
      on: true,
      count: 5,
      title: 'hi',
      mode: 'a'
    });
    expect(resolveSettings(fields, { on: false, count: 7, title: 'ok', mode: 'b' })).toEqual({ on: false, count: 7, title: 'ok', mode: 'b' });
  });

  it('sanitizes input, coercing numeric strings and reporting errors', () => {
    const good = sanitizeSettings(fields, { on: false, count: '8', title: 'abc', mode: 'b', ignored: 1 });
    expect(good.errors).toEqual({});
    expect(good.values).toEqual({ on: false, count: 8, title: 'abc', mode: 'b' });

    const bad = sanitizeSettings(fields, { on: 'x', count: 0, title: 'toolong!', mode: 'q' }, { on: true, count: 3, title: 'cur', mode: 'a' });
    expect(Object.keys(bad.errors).sort()).toEqual(['count', 'mode', 'on', 'title']);
    expect(bad.values).toEqual({ on: true, count: 3, title: 'cur', mode: 'a' });
  });

  it('keeps current values for fields that are not submitted', () => {
    const result = sanitizeSettings(fields, { count: 2 }, { on: false, count: 9, title: 'x', mode: 'b' });
    expect(result.values).toEqual({ on: false, count: 2, title: 'x', mode: 'b' });
  });

  it('does not treat prototype keys as stored values', () => {
    expect(resolveSettings(fields, JSON.parse('{"__proto__":{"on":false}}')).on).toBe(true);
  });
});

describe('localize', () => {
  it('picks the language, then English, then the first entry', () => {
    expect(localize('Plain', 'sk')).toBe('Plain');
    expect(localize({ en: 'Hello', sk: 'Ahoj' }, 'sk')).toBe('Ahoj');
    expect(localize({ en: 'Hello', sk: 'Ahoj' }, 'de')).toBe('Hello');
    expect(localize({ sk: 'Ahoj' }, 'de')).toBe('Ahoj');
    expect(localize(undefined, 'en')).toBe('');
  });
});
