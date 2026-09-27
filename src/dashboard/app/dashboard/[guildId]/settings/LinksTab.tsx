'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { useT } from '../../../components/LanguageProvider';
import { TabToolbar } from '../../../components/TabToolbar';

interface LinkEntry {
  name: string;
  url: string;
  description?: string;
}

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };
const input: React.CSSProperties = { backgroundColor: '#1B1815', border: '1px solid #3A332A', borderRadius: '6px', color: 'white', padding: '9px 12px', width: '100%' };
const btn: React.CSSProperties = { backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { backgroundColor: '#3A332A', color: '#EDE6D8', border: 'none', borderRadius: '6px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { background: 'none', border: '1px solid #D06450', color: '#D06450', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' };

export default function LinksTab({ guildId }: { guildId: string }) {
  const t = useT();
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [linksEnabled, setLinksEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/links`);
      const data = await res.json();
      setLinks(Array.isArray(data.links) ? data.links : []);
      setLinksEnabled(data.linksEnabled !== false);
    } catch (error) {
      console.debug('LinksTab: suppressed error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const addLink = () => setLinks([...links, { name: '', url: '', description: '' }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof LinkEntry, value: string) => {
    const next = [...links];
    next[i] = { ...next[i], [field]: value };
    setLinks(next);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const clean = links.filter(l => l.name.trim() && l.url.trim());
      const res = await fetch(`/api/guilds/${guildId}/links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: clean, linksEnabled })
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || clean);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={muted}>{t('cfg.links.loading')}</p>;

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="link" size={18} /> {t('cfg.links.title')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EDE6D8', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={linksEnabled} onChange={(e) => setLinksEnabled(e.target.checked)} style={{ accentColor: '#14707A' }} />
              {t('cfg.links.moduleEnabled')}
            </label>
            <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
          </div>
        </div>
        <p style={{ ...muted, marginBottom: '16px' }}>
          {t('cfg.links.descBefore')} <code>/links</code> {t('cfg.links.descAfter')}
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          {links.map((link, i) => (
            <div key={i} style={{ border: '1px solid #2C271F', borderRadius: '8px', backgroundColor: '#141517', padding: '12px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <input style={input} placeholder={t('cfg.links.namePlaceholder')} value={link.name} maxLength={80} onChange={(e) => updateLink(i, 'name', e.target.value)} />
                <input style={input} placeholder="https://example.com" value={link.url} maxLength={512} onChange={(e) => updateLink(i, 'url', e.target.value)} />
              </div>
              <input style={input} placeholder={t('cfg.links.descPlaceholder')} value={link.description || ''} maxLength={200} onChange={(e) => updateLink(i, 'description', e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" style={btnDanger} onClick={() => removeLink(i)}>
                  <Icon name="trash" size={12} /> {t('cfg.links.remove')}
                </button>
              </div>
            </div>
          ))}
          {links.length === 0 && <p style={{ ...muted, textAlign: 'center', padding: '12px 0' }}>{t('cfg.links.empty')}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button type="button" style={btnSecondary} onClick={addLink} disabled={links.length >= 25}>
            <Icon name="plus" size={12} /> {t('cfg.links.add')}
          </button>
          <button type="button" style={{ ...btn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {saved && <span style={{ color: '#6E8F4E', fontSize: '13px' }}>✓ {t('common.saved')}</span>}
          {links.length >= 25 && <span style={muted}>{t('cfg.links.max')}</span>}
        </div>
      </div>
    </div>
  );
}
