/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireGuildManager } from '@/lib/guildAuth';

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_DIR = path.join(DATA_DIR, 'json');

function loadTable(name: string): any[] {
  const file = path.join(JSON_DIR, `${name}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
      console.debug('route: suppressed error', error);
    }
  return [];
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;
  const gid = params.guildId;

  try {
    const daily = loadTable('analytics_daily').filter(r => r.guild_id === gid);
    const hourly = loadTable('analytics_hourly').filter(r => r.guild_id === gid);
    const channels = loadTable('analytics_channels').filter(r => r.guild_id === gid);
    const users = loadTable('analytics_users').filter(r => r.guild_id === gid);
    const commands = loadTable('analytics_commands').filter(r => r.guild_id === gid);

    const byDate = new Map(daily.map(r => [r.date, r]));
    const days: { date: string; messages: number; joins: number; leaves: number; commands: number; voice: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      const r: any = byDate.get(key);
      days.push({
        date: key,
        messages: r?.messages || 0,
        joins: r?.joins || 0,
        leaves: r?.leaves || 0,
        commands: r?.commands || 0,
        voice: r?.voice_minutes || 0
      });
    }

    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const h of hourly) {
      const dw = Number(h.dow) || 0;
      const hr = Number(h.hour) || 0;
      if (dw >= 0 && dw < 7 && hr >= 0 && hr < 24) heat[dw][hr] += h.messages || 0;
    }

    const topChannels = [...channels].sort((a, b) => (b.messages || 0) - (a.messages || 0)).slice(0, 8).map(c => ({ name: c.name || `#${c.channel_id}`, value: c.messages || 0 }));
    const topMembers = [...users].sort((a, b) => (b.messages || 0) - (a.messages || 0)).slice(0, 8).map(u => ({ name: u.name || u.user_id, value: u.messages || 0 }));
    const topCommands = [...commands].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8).map(c => ({ name: `/${c.name || '?'}`, value: c.count || 0 }));

    const sum = (k: 'messages' | 'joins' | 'leaves' | 'commands' | 'voice') => days.reduce((s, d) => s + d[k], 0);
    const totals = {
      messages: sum('messages'),
      joins: sum('joins'),
      leaves: sum('leaves'),
      commands: sum('commands'),
      voiceMinutes: sum('voice'),
      net: sum('joins') - sum('leaves')
    };

    const last7 = days.slice(-7);
    const avgMsg = last7.reduce((s, d) => s + d.messages, 0) / 7;
    const activity = Math.round(100 * Math.tanh(avgMsg / 150));
    const activeDays14 = days.slice(-14).filter(d => d.messages > 0).length;
    const consistency = Math.round((activeDays14 / 14) * 100);
    const gTotal = totals.joins + totals.leaves;
    const growthHealth = Math.max(0, Math.min(100, Math.round(50 + 50 * (totals.net / Math.max(gTotal, 1)))));

    const rolesSnap = loadTable('analytics_roles').filter(r => r.guild_id === gid);
    const memberTotal = rolesSnap.length ? Math.max(...rolesSnap.map(r => r.member_total || 0)) : 0;
    const roles = [...rolesSnap]
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 12)
      .map(r => ({ name: r.name || r.role_id, count: r.count || 0, color: r.color && r.color !== '#000000' ? r.color : '#14707A' }));

    const modlogs = loadTable('mod_logs').filter(r => r.guild_id === gid);
    const warnings = loadTable('warnings').filter(r => r.guild_id === gid);
    const punitive = new Set(['ban', 'softban', 'kick', 'timeout', 'mute', 'tempban']);
    const actionCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};
    const modByDate = new Map<string, number>();
    for (const m of modlogs) {
      const action = m.action || 'other';
      actionCounts[action] = (actionCounts[action] || 0) + 1;
      if (punitive.has(action)) {
        const reason = (m.reason && String(m.reason).trim()) || 'No reason given';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
      const dt = m.created_at ? ymd(new Date(m.created_at)) : '';
      if (dt) modByDate.set(dt, (modByDate.get(dt) || 0) + 1);
    }
    const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    const actionBreakdown = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const modByDay = days.map(d => modByDate.get(d.date) || 0);
    const moderation = {
      totalActions: modlogs.length,
      warnings: warnings.length,
      actionBreakdown,
      topReasons,
      byDay: modByDay
    };

    const tickets = loadTable('tickets').filter(r => r.guild_id === gid);
    const closed = tickets.filter(t => t.status === 'closed');
    const resolutions = closed
      .filter(t => t.closed_at && t.created_at)
      .map(t => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000)
      .filter(m => m >= 0);
    const avgResolutionMins = resolutions.length ? Math.round(resolutions.reduce((s, m) => s + m, 0) / resolutions.length) : 0;
    const ticketByDate = new Map<string, number>();
    for (const t of tickets) {
      const dt = t.created_at ? ymd(new Date(t.created_at)) : '';
      if (dt) ticketByDate.set(dt, (ticketByDate.get(dt) || 0) + 1);
    }
    const ticketStats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      closed: closed.length,
      avgResolutionMins,
      byDay: days.map(d => ticketByDate.get(d.date) || 0)
    };

    const avgNetPerDay = totals.net / 30;
    const prev7 = days.slice(-14, -7);
    const last7Days = days.slice(-7);
    const avgPrev7 = prev7.reduce((s, d) => s + d.messages, 0) / 7;
    const avgLast7 = last7Days.reduce((s, d) => s + d.messages, 0) / 7;
    const msgTrendPct = Math.round(((avgLast7 - avgPrev7) / Math.max(avgPrev7, 1)) * 100);
    const predictions = {
      avgNetPerDay: Math.round(avgNetPerDay * 10) / 10,
      projected7: Math.round(avgNetPerDay * 7),
      projected30: Math.round(avgNetPerDay * 30),
      msgTrendPct
    };

    return NextResponse.json({
      days,
      heat,
      topChannels,
      topMembers,
      topCommands,
      totals,
      scores: { activity, consistency, growthHealth },
      roles,
      memberTotal,
      moderation,
      tickets: ticketStats,
      predictions,
      hasData: daily.length > 0 || hourly.length > 0
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
