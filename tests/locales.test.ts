/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LANGUAGE_CODES } from '../src/shared/languages';

const LOCALES = path.join(process.cwd(), 'src', 'locales');
const SOURCE = 'en';

function flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === 'string') {
    out[prefix] = node;
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function load(code: string): Record<string, string> {
  return flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, `${code}.json`), 'utf-8')));
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const base = load(SOURCE);
const others = LANGUAGE_CODES.filter((c) => c !== SOURCE);

describe('locales', () => {
  it('has a file for every declared language', () => {
    for (const code of LANGUAGE_CODES) {
      expect(fs.existsSync(path.join(LOCALES, `${code}.json`)), `${code}.json`).toBe(true);
    }
  });

  it('declares every locale file as a language', () => {
    const files = fs
      .readdirSync(LOCALES)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
    for (const file of files) {
      expect(LANGUAGE_CODES as readonly string[], `${file}.json is not in languages.ts`).toContain(file);
    }
  });

  it.each(others)('%s has exactly the keys of en', (code) => {
    const flat = load(code);
    expect(Object.keys(base).filter((k) => !(k in flat))).toEqual([]);
    expect(Object.keys(flat).filter((k) => !(k in base))).toEqual([]);
  });

  it.each(others)('%s has no empty or untranslated values', (code) => {
    const flat = load(code);
    expect(Object.entries(flat).filter(([, v]) => !v.trim() || v.startsWith('[TODO] ')).map(([k]) => k)).toEqual([]);
  });

  it.each(others)('%s keeps every placeholder from en', (code) => {
    const flat = load(code);
    const broken = Object.keys(base).filter(
      (k) => k in flat && placeholders(flat[k]).join(',') !== placeholders(base[k]).join(',')
    );
    expect(broken).toEqual([]);
  });
});
