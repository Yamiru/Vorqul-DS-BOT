/*!
 * Vorqul DS BOT - Status Reporter
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Client } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { readVersion } from '../../shared/version.js';

const DATA_DIR = process.env.DATA_PATH || './data';
const STATUS_FILE = path.join(DATA_DIR, 'json', 'bot_status.json');

export const HEARTBEAT_INTERVAL_MS = 15_000;

export interface BotStatus {
  online: boolean;
  updatedAt: string;
  version: string;
  tag: string | null;
  guilds: number;
  users: number;
  channels: number;
  ping: number;
  uptimeSeconds: number;
  memory: { usedMb: number; totalMb: number; percent: number };
  cpu: { percent: number; cores: number; loadAvg: number };
  commands: number;
  heartbeatIntervalMs: number;
}

let lastCpuUsage = process.cpuUsage();
let lastCpuAt = Date.now();
const version = readVersion();

function processCpuPercent(): number {
  const now = Date.now();
  const usage = process.cpuUsage(lastCpuUsage);
  const elapsedMs = now - lastCpuAt;

  lastCpuUsage = process.cpuUsage();
  lastCpuAt = now;

  if (elapsedMs <= 0) return 0;

  const usedMs = (usage.user + usage.system) / 1000;
  const percent = (usedMs / elapsedMs) * 100;
  return Math.min(100, Math.round(percent * 10) / 10);
}

function collect(client: Client): BotStatus {
  const memoryUsage = process.memoryUsage();
  const usedMb = Math.round(memoryUsage.rss / 1024 / 1024);
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);

  let users = 0;
  for (const guild of client.guilds.cache.values()) {
    users += guild.memberCount || 0;
  }

  return {
    online: true,
    updatedAt: new Date().toISOString(),
    version,
    tag: client.user?.tag || null,
    guilds: client.guilds.cache.size,
    users,
    channels: client.channels.cache.size,
    ping: Math.max(0, Math.round(client.ws.ping)),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      usedMb,
      totalMb,
      percent: totalMb > 0 ? Math.round((usedMb / totalMb) * 1000) / 10 : 0,
    },
    cpu: {
      percent: processCpuPercent(),
      cores: os.cpus().length,
      loadAvg: Math.round(os.loadavg()[0] * 100) / 100,
    },
    commands: client.commands?.size || 0,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  };
}

function write(status: BotStatus): void {
  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const temp = `${STATUS_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(status, null, 2), 'utf-8');
    fs.renameSync(temp, STATUS_FILE);
  } catch (error) {
    logger.error('Failed to write bot status:', error as Error);
  }
}

export function startStatusReporter(client: Client): void {
  write(collect(client));

  const timer = setInterval(() => {
    try {
      write(collect(client));
    } catch (error) {
      logger.error('Status heartbeat failed:', error as Error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  timer.unref?.();

  const markOffline = () => {
    try {
      const status = collect(client);
      write({ ...status, online: false });
    } catch (error) {
        logger.debug('statusReporter: suppressed error', error);
      }
  };

  process.once('SIGINT', markOffline);
  process.once('SIGTERM', markOffline);

  logger.info('Status reporter started');
}
