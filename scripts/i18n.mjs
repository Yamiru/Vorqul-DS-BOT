#!/usr/bin/env node
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(ROOT, 'src', 'locales');
const SOURCE = 'en';
const TODO = '[TODO] ';

function read(code) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, `${code}.json`), 'utf-8'));
}

function write(code, data) {
  const file = path.join(LOCALES, `${code}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, file);
}

function codes() {
  return fs
    .readdirSync(LOCALES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
}

function flatten(node, prefix = '', out = {}) {
  if (typeof node === 'string') {
    out[prefix] = node;
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function setPath(root, dotted, value) {
  const parts = dotted.split('.');
  let cur = root;
  for (const p of parts.slice(0, -1)) {
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}

function reorder(target, template) {
  if (typeof template !== 'object' || template === null) return target;
  const out = {};
  for (const [k, v] of Object.entries(template)) {
    if (!(k in target)) continue;
    out[k] = typeof v === 'object' && v !== null ? reorder(target[k], v) : target[k];
  }
  return out;
}

function placeholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

function problems() {
  const base = flatten(read(SOURCE));
  const found = [];

  for (const code of codes()) {
    if (code === SOURCE) continue;
    const flat = flatten(read(code));

    for (const key of Object.keys(base)) {
      if (!(key in flat)) {
        found.push({ code, key, kind: 'missing' });
        continue;
      }
      const value = flat[key];
      if (typeof value !== 'string' || value.trim() === '') {
        found.push({ code, key, kind: 'empty' });
        continue;
      }
      if (value.startsWith(TODO)) {
        found.push({ code, key, kind: 'untranslated' });
        continue;
      }
      const want = placeholders(base[key]).join(',');
      const got = placeholders(value).join(',');
      if (want !== got) {
        found.push({ code, key, kind: 'placeholder', detail: `expected {${want}} got {${got}}` });
      }
    }

    for (const key of Object.keys(flat)) {
      if (!(key in base)) found.push({ code, key, kind: 'extra' });
    }
  }
  return found;
}

function cmdCheck() {
  const found = problems();
  if (!found.length) {
    console.log(`All ${codes().length} locales match ${SOURCE}.json (${Object.keys(flatten(read(SOURCE))).length} keys each).`);
    return 0;
  }
  const byCode = {};
  for (const p of found) (byCode[p.code] ??= []).push(p);
  for (const [code, list] of Object.entries(byCode)) {
    console.log(`\n${code}.json — ${list.length} problem(s)`);
    for (const p of list.slice(0, 40)) {
      console.log(`  ${p.kind.padEnd(13)} ${p.key}${p.detail ? '  ' + p.detail : ''}`);
    }
    if (list.length > 40) console.log(`  … and ${list.length - 40} more`);
  }
  console.log('');
  return 1;
}

function cmdSync() {
  const template = read(SOURCE);
  const base = flatten(template);
  let touched = 0;

  for (const code of codes()) {
    if (code === SOURCE) continue;
    const data = read(code);
    const flat = flatten(data);
    let changed = 0;

    for (const [key, value] of Object.entries(base)) {
      if (!(key in flat)) {
        setPath(data, key, TODO + value);
        changed++;
      }
    }
    for (const key of Object.keys(flat)) {
      if (!(key in base)) changed++;
    }

    if (changed) {
      write(code, reorder(data, template));
      console.log(`${code}.json — ${changed} key(s) reconciled`);
      touched++;
    }
  }
  console.log(touched ? '' : 'Nothing to sync.');
  return 0;
}

function cmdAdd(code) {
  if (!code || !/^[a-z]{2}$/.test(code)) {
    console.error('Usage: npm run i18n:add -- <two-letter-code>');
    return 1;
  }
  const file = path.join(LOCALES, `${code}.json`);
  if (fs.existsSync(file)) {
    console.error(`${code}.json already exists.`);
    return 1;
  }
  const template = read(SOURCE);
  const data = {};
  for (const [key, value] of Object.entries(flatten(template))) {
    setPath(data, key, TODO + value);
  }
  write(code, reorder(data, template));
  console.log(`Created src/locales/${code}.json with ${Object.keys(flatten(template)).length} keys marked "${TODO.trim()}".`);
  console.log(`Next: add { code: '${code}', label: '…', flag: '…' } to src/shared/languages.ts,`);
  console.log(`      import it in src/dashboard/lib/i18n.ts, then translate the [TODO] entries by hand.`);
  return 0;
}

function cmdMissing(code) {
  const list = problems().filter((p) => (!code || p.code === code) && p.kind !== 'extra');
  if (!list.length) {
    console.log(code ? `${code}.json is complete.` : 'Every locale is complete.');
    return 0;
  }
  for (const p of list) console.log(`${p.code}\t${p.kind}\t${p.key}`);
  return 0;
}

const [command, argument] = process.argv.slice(2);

const commands = {
  check: cmdCheck,
  sync: cmdSync,
  add: () => cmdAdd(argument),
  missing: () => cmdMissing(argument)
};

if (!commands[command]) {
  console.log('Usage: node scripts/i18n.mjs <check|sync|add|missing> [code]');
  process.exit(1);
}

process.exit((await commands[command]()) ?? 0);
