/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';

// .version at the project root is the single source of truth for the bot's
// version - read by the console banner, the bot's status heartbeat and the
// dashboard. package.json is only a fallback for a checkout missing the file.
export function readVersion(): string {
  try {
    const v = fs.readFileSync(path.join(process.cwd(), '.version'), 'utf-8').trim();
    if (v) return v;
  } catch {
    // fall through to package.json
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    if (pkg?.version) return String(pkg.version);
  } catch {
    // fall through to the default below
  }
  return '1.0.0';
}
