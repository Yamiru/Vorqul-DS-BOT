'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useState } from 'react';
import { useT } from './LanguageProvider';

interface Status {
  online: boolean;
  version?: string;
  latestVersion?: string | null;
  updateAvailable?: boolean;
  tag: string | null;
  guilds: number;
  users: number;
  ping: number;
  uptimeSeconds: number;
  commands: number;
  memory: { usedMb: number; totalMb: number; percent: number };
  cpu: { percent: number; cores: number; loadAvg: number };
  stale?: boolean;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function Tile({ label, value, hint, accent }: {
  label: string; value: string; hint?: string; accent?: string;
}) {
  return (
    <div className="bg-[#1B1815] border border-[#221E19] rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#948C7C]">{label}</div>
      <div className="text-xl font-semibold mt-1" style={{ color: accent || '#ffffff' }}>{value}</div>
      {hint && <div className="text-[11px] text-[#948C7C] mt-0.5">{hint}</div>}
    </div>
  );
}

export default function BotStatusPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch (error) {
          console.debug('BotStatusPanel: suppressed error', error);
        } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (loading) {
    return (
      <div className="bg-[#1B1815] border border-[#221E19] rounded-xl p-6 mb-6 animate-pulse">
        <div className="h-4 w-40 bg-[#221E19] rounded" />
      </div>
    );
  }

  const online = status?.online === true;
  const pingColor = !online ? '#948C7C' : status!.ping < 150 ? '#6E8F4E' : status!.ping < 400 ? '#D9A441' : '#D06450';
  const cpuColor = !online ? '#948C7C' : status!.cpu.percent < 60 ? '#6E8F4E' : status!.cpu.percent < 85 ? '#D9A441' : '#D06450';
  const memColor = !online ? '#948C7C' : status!.memory.percent < 70 ? '#6E8F4E' : status!.memory.percent < 90 ? '#D9A441' : '#D06450';

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: online ? '#6E8F4E' : '#D06450' }}
        />
        <h2 className="text-white font-semibold">
          {online ? t('home.running') : t('home.offline')}
        </h2>
        {status?.tag && <span className="text-sm text-[#948C7C]">{status.tag}</span>}
        {status?.version && <span className="text-xs text-[#948C7C] bg-[#1B1815] border border-[#221E19] rounded-full px-2 py-0.5">v{status.version}</span>}
        {status?.updateAvailable && status.latestVersion && (
          <span className="text-xs text-[#D9A441] bg-[#1B1815] border border-[#D9A441] rounded-full px-2 py-0.5">
            {t('home.updateAvailable', { version: status.latestVersion })}
          </span>
        )}
      </div>

      {!online && (
        <p className="text-sm text-[#948C7C] mb-3">
          {t('home.noHeartbeat')}
        </p>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Tile label={t('home.servers')} value={online ? formatCount(status!.guilds) : '-'} />
        <Tile label={t('home.users')} value={online ? formatCount(status!.users) : '-'} />
        <Tile label={t('home.ping')} value={online ? `${status!.ping} ms` : '-'} accent={pingColor} />
        <Tile label={t('home.uptime')} value={online ? formatUptime(status!.uptimeSeconds) : '-'} />
        <Tile
          label={t('home.cpu')}
          value={online ? `${status!.cpu.percent} %` : '-'}
          hint={online ? t('home.cores', { n: status!.cpu.cores, load: status!.cpu.loadAvg }) : undefined}
          accent={cpuColor}
        />
        <Tile
          label={t('home.ram')}
          value={online ? `${status!.memory.usedMb} MB` : '-'}
          hint={online ? t('home.ofTotal', { p: status!.memory.percent, total: status!.memory.totalMb }) : undefined}
          accent={memColor}
        />
        <Tile label={t('home.commands')} value={online ? String(status!.commands) : '-'} />
        <Tile label={t('home.refreshes')} value="15 s" hint={t('home.auto')} />
      </div>
    </div>
  );
}
