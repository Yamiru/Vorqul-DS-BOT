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

interface AuditItem { kind: string; type: string; actor: string; target: string; detail: string; at: string; }

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const h3: React.CSSProperties = { color: 'white', marginBottom: '12px', fontWeight: 600, fontSize: '15px' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };

const KIND_COLOR: Record<string, string> = { moderation: '#D06450', dashboard: '#14707A' };

export default function AuditTab({ guildId }: { guildId: string }) {
  const t = useT();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'moderation' | 'dashboard'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/audit`);
      const json = await res.json();
      setItems(json.items || []);
    } catch (error) {
        console.debug('AuditTab: suppressed error', error);
      }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const shown = items.filter(i => filter === 'all' || i.kind === filter);

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '12px' }}>
          <h3 style={{ ...h3, marginBottom: 0 }}>{t('sx.audit.title')}</h3>
          <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
        </div>
        <p style={{ ...muted, marginBottom: '12px', marginTop: '8px' }}>{t('sx.audit.subtitle')}</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          {(['all', 'moderation', 'dashboard'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#14707A' : '#1B1815', color: filter === f ? 'white' : '#948C7C',
              border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize'
            }}>{t(`sx.audit.filter.${f}`)}</button>
          ))}
        </div>
      </div>

      <div style={card}>
        {loading ? <p style={muted}>{t('sx.common.loading')}</p> : shown.length === 0 ? <p style={muted}>{t('sx.audit.empty')}</p> : (
          <div style={{ display: 'grid', gap: '6px' }}>
            {shown.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '9px 12px', backgroundColor: '#1B1815', borderRadius: '8px', alignItems: 'flex-start' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: KIND_COLOR[it.kind] || '#948C7C', marginTop: '5px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#EDE6D8', fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{it.type}</span>
                    {it.target ? <span style={muted}> → {it.target}</span> : null}
                  </div>
                  {it.detail ? <div style={{ ...muted, marginTop: '1px' }}>{it.detail}</div> : null}
                  <div style={{ ...muted, marginTop: '2px' }}>{it.actor} · {it.at ? new Date(it.at).toLocaleString() : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
