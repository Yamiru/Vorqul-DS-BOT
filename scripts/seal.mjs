#!/usr/bin/env node
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SEALED = [
  'LICENSE',
  'start.js',
  'src/shared/brand.ts',
  'src/dashboard/lib/brand.ts',
  'src/utils/embedHelper.ts',
  'src/bot/commands/utility/help.ts',
  'src/dashboard/app/layout.tsx',
  'src/dashboard/app/page.tsx'
];

const hash = (file) =>
  createHash('sha256').update(readFileSync(join(ROOT, file), 'utf-8').replace(/\r/g, '')).digest('hex');

const files = Object.fromEntries(SEALED.map((f) => [f, hash(f)]));
const lock = {
  note: 'Integrity seal for the Vorqul DS BOT branding files. Do not edit; see LICENSE.',
  files
};

if (process.argv.includes('--check')) {
  const current = JSON.parse(readFileSync(join(ROOT, 'brand.lock.json'), 'utf-8')).files;
  const changed = SEALED.filter((f) => current[f] !== files[f]);
  if (changed.length) {
    console.error('Seal mismatch: ' + changed.join(', '));
    process.exit(1);
  }
  console.log('Seal OK (' + SEALED.length + ' files).');
} else {
  writeFileSync(join(ROOT, 'brand.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  console.log('brand.lock.json rewritten for ' + SEALED.length + ' files.');
}
