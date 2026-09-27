'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useState } from 'react';
import { useT } from '../../../components/LanguageProvider';
import { TabToolbar } from '../../../components/TabToolbar';

interface Series { date: string; messages: number; joins: number; leaves: number; commands: number; voice: number; }
interface TopItem { name: string; value: number; }
interface RoleItem { name: string; count: number; color: string; }
interface AnalyticsData {
  days: Series[];
  heat: number[][];
  topChannels: TopItem[];
  topMembers: TopItem[];
  topCommands: TopItem[];
  totals: { messages: number; joins: number; leaves: number; commands: number; voiceMinutes: number; net: number };
  scores: { activity: number; consistency: number; growthHealth: number };
  roles?: RoleItem[];
  memberTotal?: number;
  moderation?: { totalActions: number; warnings: number; actionBreakdown: TopItem[]; topReasons: TopItem[]; byDay: number[] };
  tickets?: { total: number; open: number; closed: number; avgResolutionMins: number; byDay: number[] };
  predictions?: { avgNetPerDay: number; projected7: number; projected30: number; msgTrendPct: number };
  hasData: boolean;
}

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const h3: React.CSSProperties = { color: 'white', marginBottom: '14px', fontWeight: 600, fontSize: '15px' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ flex: '1 1 130px', backgroundColor: '#1B1815', borderRadius: '10px', padding: '14px 16px', borderLeft: `3px solid ${accent}` }}>
      <div style={{ color: 'white', fontSize: '22px', fontWeight: 700 }}>{value}</div>
      <div style={{ ...muted, marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{label}</span>
        <span style={{ color, fontSize: '13px', fontWeight: 600 }}>{score}/100</span>
      </div>
      <div style={{ height: '8px', backgroundColor: '#1B1815', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: '100%', backgroundColor: color, borderRadius: '999px' }} />
      </div>
    </div>
  );
}

function AreaChart({ values, color, labels }: { values: number[]; color: string; labels: string[] }) {
  const W = 640, H = 140, P = 6;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, n - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
        <path d={area} fill={color} fillOpacity={0.15} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...muted, marginTop: '4px' }}>
        <span>{labels[0]}</span><span>{labels[Math.floor(n / 2)]}</span><span>{labels[n - 1]}</span>
      </div>
    </div>
  );
}

function JoinsLeaves({ days }: { days: Series[] }) {
  const W = 640, H = 120, P = 6, mid = H / 2;
  const max = Math.max(1, ...days.map(d => Math.max(d.joins, d.leaves)));
  const n = days.length;
  const bw = (W - 2 * P) / n * 0.7;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
      <line x1={P} y1={mid} x2={W - P} y2={mid} stroke="#3A332A" strokeWidth={1} />
      {days.map((d, i) => {
        const cx = P + (i + 0.5) * (W - 2 * P) / n;
        const jh = (d.joins / max) * (mid - P);
        const lh = (d.leaves / max) * (mid - P);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={mid - jh} width={bw} height={jh} fill="#6E8F4E" rx={1} />
            <rect x={cx - bw / 2} y={mid} width={bw} height={lh} fill="#D06450" rx={1} />
          </g>
        );
      })}
    </svg>
  );
}

function Heatmap({ heat }: { heat: number[][] }) {
  const t = useT();
  const dows = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(k => t(`sx.analytics.dow.${k}`));
  const max = Math.max(1, ...heat.flat());
  const shade = (v: number) => {
    if (v === 0) return '#1B1815';
    const t = v / max;

    const a = 0.15 + t * 0.85;
    return `rgba(88,101,242,${a.toFixed(2)})`;
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `34px repeat(24, 1fr)`, gap: '2px', minWidth: '520px' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ ...muted, fontSize: '9px', textAlign: 'center' }}>{h % 6 === 0 ? h : ''}</div>
        ))}
        {heat.map((row, d) => (
          <div key={d} style={{ display: 'contents' }}>
            <div style={{ ...muted, fontSize: '10px', lineHeight: '14px' }}>{dows[d]}</div>
            {row.map((v, h) => (
              <div key={h} title={t('sx.analytics.heatTooltip', { day: dows[d], hour: h, count: v })} style={{ aspectRatio: '1 / 1', backgroundColor: shade(v), borderRadius: '2px', minHeight: '12px' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ items, color }: { items: TopItem[]; color: string }) {
  const t = useT();
  const max = Math.max(1, ...items.map(i => i.value));
  if (items.length === 0) return <p style={muted}>{t('sx.analytics.noData')}</p>;
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ color: '#EDE6D8', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{it.name}</span>
            <span style={{ ...muted }}>{it.value.toLocaleString()}</span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#1B1815', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleBars({ roles, total }: { roles: RoleItem[]; total: number }) {
  const t = useT();
  const max = Math.max(1, ...roles.map(r => r.count));
  if (roles.length === 0) return <p style={muted}>{t('sx.analytics.noRoleSnapshot')}</p>;
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {roles.map((r, i) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#EDE6D8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: r.color, display: 'inline-block' }} />
                {r.name}
              </span>
              <span style={muted}>{r.count.toLocaleString()}{total ? ` · ${pct}%` : ''}</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#1B1815', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', backgroundColor: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '-';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export default function AnalyticsTab({ guildId }: { guildId: string }) {
  const t = useT();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/analytics`);
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  if (loading) return <p style={muted}>{t('sx.analytics.loading')}</p>;
  if (error || !data) return <p style={muted}>{t('sx.analytics.loadError')}</p>;

  const labels = data.days.map(d => d.date.slice(5));
  const voiceHours = Math.round(data.totals.voiceMinutes / 60);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
      </div>
      {!data.hasData && (
        <div style={{ ...card, borderColor: '#D9A441' }}>
          <p style={{ color: '#D9A441', fontSize: '13px', margin: 0 }}>{t('sx.analytics.noDataCollected')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <StatCard label={t('sx.analytics.messages30d')} value={data.totals.messages.toLocaleString()} accent="#14707A" />
        <StatCard label={t('sx.analytics.netMembers30d')} value={`${data.totals.net >= 0 ? '+' : ''}${data.totals.net}`} accent={data.totals.net >= 0 ? '#6E8F4E' : '#D06450'} />
        <StatCard label={t('sx.analytics.voiceHours30d')} value={voiceHours.toLocaleString()} accent="#B0567E" />
        <StatCard label={t('sx.analytics.commands30d')} value={data.totals.commands.toLocaleString()} accent="#D9A441" />
      </div>

      <div style={card}>
        <h3 style={h3}>{t('sx.analytics.healthScores')} <span style={{ ...muted, fontWeight: 400 }}>{t('sx.analytics.heuristic')}</span></h3>
        <ScoreBar label={t('sx.analytics.activity')} score={data.scores.activity} color="#14707A" />
        <ScoreBar label={t('sx.analytics.consistency')} score={data.scores.consistency} color="#6E8F4E" />
        <ScoreBar label={t('sx.analytics.growthHealth')} score={data.scores.growthHealth} color="#B0567E" />
      </div>

      {data.predictions && (
        <div style={card}>
          <h3 style={h3}>{t('sx.analytics.growthForecast')} <span style={{ ...muted, fontWeight: 400 }}>{t('sx.analytics.trendProjection')}</span></h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <StatCard label={t('sx.analytics.avgNetPerDay')} value={`${data.predictions.avgNetPerDay >= 0 ? '+' : ''}${data.predictions.avgNetPerDay}`} accent="#14707A" />
            <StatCard label={t('sx.analytics.projected7')} value={`${data.predictions.projected7 >= 0 ? '+' : ''}${data.predictions.projected7}`} accent={data.predictions.projected7 >= 0 ? '#6E8F4E' : '#D06450'} />
            <StatCard label={t('sx.analytics.projected30')} value={`${data.predictions.projected30 >= 0 ? '+' : ''}${data.predictions.projected30}`} accent={data.predictions.projected30 >= 0 ? '#6E8F4E' : '#D06450'} />
            <StatCard label={t('sx.analytics.msgTrend7d')} value={`${data.predictions.msgTrendPct >= 0 ? '+' : ''}${data.predictions.msgTrendPct}%`} accent={data.predictions.msgTrendPct >= 0 ? '#6E8F4E' : '#D9A441'} />
          </div>
          <p style={{ ...muted, marginTop: '10px', marginBottom: 0 }}>{t('sx.analytics.forecastNote')}</p>
        </div>
      )}

      <div style={card}>
        <h3 style={h3}>{t('sx.analytics.messagesPerDay')}</h3>
        <AreaChart values={data.days.map(d => d.messages)} color="#14707A" labels={labels} />
      </div>

      <div style={card}>
        <h3 style={h3}>{t('sx.analytics.joinsVsLeaves')} <span style={{ ...muted, fontWeight: 400 }}>{t('sx.analytics.joinsVsLeavesLegend')}</span></h3>
        <JoinsLeaves days={data.days} />
      </div>

      <div style={card}>
        <h3 style={h3}>{t('sx.analytics.heatmap')} <span style={{ ...muted, fontWeight: 400 }}>{t('sx.analytics.heatmapHint')}</span></h3>
        <Heatmap heat={data.heat} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={card}><h3 style={h3}>{t('sx.analytics.topChannels')}</h3><TopList items={data.topChannels} color="#14707A" /></div>
        <div style={card}><h3 style={h3}>{t('sx.analytics.topMembers')}</h3><TopList items={data.topMembers} color="#6E8F4E" /></div>
        <div style={card}><h3 style={h3}>{t('sx.analytics.topCommands')}</h3><TopList items={data.topCommands} color="#D9A441" /></div>
      </div>

      {data.roles && (
        <div style={card}>
          <h3 style={h3}>{t('sx.analytics.membersByRole')} {data.memberTotal ? <span style={{ ...muted, fontWeight: 400 }}>{t('sx.analytics.membersTotal', { count: data.memberTotal.toLocaleString() })}</span> : null}</h3>
          <RoleBars roles={data.roles} total={data.memberTotal || 0} />
        </div>
      )}

      {data.moderation && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={card}>
            <h3 style={h3}>{t('sx.analytics.moderationActions')}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <StatCard label={t('sx.analytics.totalActions')} value={data.moderation.totalActions.toLocaleString()} accent="#D06450" />
              <StatCard label={t('sx.analytics.warningsOnRecord')} value={data.moderation.warnings.toLocaleString()} accent="#D9A441" />
            </div>
            <TopList items={data.moderation.actionBreakdown} color="#D06450" />
          </div>
          <div style={card}>
            <h3 style={h3}>{t('sx.analytics.topReasons')}</h3>
            <TopList items={data.moderation.topReasons} color="#B0567E" />
          </div>
        </div>
      )}

      {data.tickets && (data.tickets.total > 0) && (
        <div style={card}>
          <h3 style={h3}>{t('sx.analytics.supportTickets')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <StatCard label={t('sx.analytics.ticketsTotal')} value={data.tickets.total.toLocaleString()} accent="#14707A" />
            <StatCard label={t('sx.analytics.ticketsOpen')} value={data.tickets.open.toLocaleString()} accent="#6E8F4E" />
            <StatCard label={t('sx.analytics.ticketsClosed')} value={data.tickets.closed.toLocaleString()} accent="#948C7C" />
            <StatCard label={t('sx.analytics.avgResolution')} value={formatDuration(data.tickets.avgResolutionMins)} accent="#B0567E" />
          </div>
        </div>
      )}
    </div>
  );
}
