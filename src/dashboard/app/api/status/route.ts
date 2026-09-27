/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { readVersion } from '@shared/version';
import { getLatestVersion, isNewerVersion } from '@/lib/updateCheck';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.DATA_PATH || './data';
const STATUS_FILE = path.join(DATA_DIR, 'json', 'bot_status.json');

const OFFLINE = {
  online: false,
  updatedAt: null,
  version: readVersion(),
  tag: null,
  guilds: 0,
  users: 0,
  channels: 0,
  ping: 0,
  uptimeSeconds: 0,
  memory: { usedMb: 0, totalMb: 0, percent: 0 },
  cpu: { percent: 0, cores: 0, loadAvg: 0 },
  commands: 0,
  stale: true,
};

async function updateInfo(currentVersion: string) {
  const latestVersion = await getLatestVersion();
  return {
    latestVersion,
    updateAvailable: !!latestVersion && isNewerVersion(latestVersion, currentVersion)
  };
}

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!fs.existsSync(STATUS_FILE)) {
      return NextResponse.json({ ...OFFLINE, ...(await updateInfo(OFFLINE.version)), reason: 'no-heartbeat' });
    }

    const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));

    const interval = Number(status.heartbeatIntervalMs) || 15_000;
    const age = Date.now() - new Date(status.updatedAt).getTime();
    const stale = !Number.isFinite(age) || age > interval * 2.5;

    return NextResponse.json({
      ...status,
      online: status.online === true && !stale,
      stale,
      ageSeconds: Number.isFinite(age) ? Math.round(age / 1000) : null,
      ...(await updateInfo(status.version || OFFLINE.version)),
    });
  } catch (error) {
    console.error('Failed to read bot status:', error);
    return NextResponse.json({ ...OFFLINE, ...(await updateInfo(OFFLINE.version)), reason: 'read-error' });
  }
}
