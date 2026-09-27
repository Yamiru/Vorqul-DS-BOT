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

interface KeyRow { id: string; name: string; prefix: string; created_at: string; last_used: string | null; }

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const h3: React.CSSProperties = { color: 'white', marginBottom: '12px', fontWeight: 600, fontSize: '15px' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };
const input: React.CSSProperties = { backgroundColor: '#1B1815', border: '1px solid #3A332A', borderRadius: '6px', color: 'white', padding: '9px 12px', width: '100%' };
const btn: React.CSSProperties = { backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };

export default function ApiKeysTab({ guildId }: { guildId: string }) {
  const t = useT();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/apikeys`);
      const json = await res.json();
      setKeys(json.keys || []);
    } catch (error) {
        console.debug('ApiKeysTab: suppressed error', error);
      }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setNewKey(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/apikeys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.key) {
        alert(`❌ ${json.error || t('sx.apikeys.createFailed', { status: res.status })}`);
        return;
      }
      setNewKey(json.key); setName(''); await load();
    } catch (error) {
      console.error('ApiKeysTab: create failed', error);
      alert(t('sx.apikeys.networkError'));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm(t('sx.apikeys.revokeConfirm'))) return;
    try {
      const res = await fetch(`/api/guilds/${guildId}/apikeys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`❌ ${err.error || t('sx.apikeys.revokeFailed', { status: res.status })}`);
        return;
      }
      await load();
    } catch (error) {
      console.error('ApiKeysTab: revoke failed', error);
      alert(t('sx.apikeys.networkError'));
    }
  };

  const base = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div>
      <div style={card}>
        <h3 style={h3}>{t('sx.apikeys.title')}</h3>
        <p style={{ ...muted, marginBottom: '14px' }}>
          {t('sx.apikeys.description')}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: '1 1 220px' }} placeholder={t('sx.apikeys.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          <button style={{ ...btn, opacity: creating ? 0.6 : 1 }} onClick={create} disabled={creating}>{creating ? t('sx.apikeys.creating') : t('sx.apikeys.create')}</button>
        </div>

        {newKey && (
          <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#1B1815', border: '1px solid #D9A441', borderRadius: '8px' }}>
            <div style={{ color: '#D9A441', fontSize: '12px', marginBottom: '6px' }}>{t('sx.apikeys.copyNow')}</div>
            <code style={{ color: '#EDE6D8', fontSize: '13px', wordBreak: 'break-all' }}>{newKey}</code>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          <h3 style={{ ...h3, marginBottom: 0 }}>{t('sx.apikeys.yourKeys')}</h3>
          <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
        </div>
        {loading ? <p style={muted}>{t('sx.common.loading')}</p> : keys.length === 0 ? <p style={muted}>{t('sx.apikeys.empty')}</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {keys.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', backgroundColor: '#1B1815', borderRadius: '8px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#EDE6D8', fontSize: '13px' }}>{k.name}</div>
                  <div style={muted}><code>{k.prefix}…</code> · {k.last_used ? t('sx.apikeys.lastUsed', { date: new Date(k.last_used).toLocaleDateString() }) : t('sx.apikeys.neverUsed')}</div>
                </div>
                <button style={{ background: 'none', border: '1px solid #D06450', color: '#D06450', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} onClick={() => revoke(k.id)}>{t('sx.apikeys.revoke')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>{t('sx.apikeys.example')}</h3>
        <code style={{ color: '#EDE6D8', fontSize: '12px', wordBreak: 'break-all', display: 'block' }}>
          {`curl -H "Authorization: Bearer vdb_…" ${base}/api/v1/${guildId}/stats`}
        </code>
      </div>
    </div>
  );
}
