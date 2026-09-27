'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../../components/LanguageProvider';
import { TabToolbar } from '../../../components/TabToolbar';
import {
  FEATURES,
  FEATURE_GROUPS,
  normalizeScope,
  type ChannelScope,
  type ScopeMode,
} from '../../../../lib/channelScope';

interface Channel { id: string; name: string; type: number; parentId: string | null }

const CHANNEL_TYPE_TEXT = [0, 5, 15];
const CHANNEL_TYPE_VOICE = [2, 13];
const CHANNEL_TYPE_CATEGORY = 4;

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const h3: React.CSSProperties = { color: 'white', marginBottom: '12px', fontWeight: 600, fontSize: '15px' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };
const input: React.CSSProperties = { backgroundColor: '#1B1815', border: '1px solid #3A332A', borderRadius: '6px', color: 'white', padding: '9px 12px', width: '100%' };
const btn: React.CSSProperties = { backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const modeBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none',
  backgroundColor: active ? '#14707A' : '#2C271F', color: active ? 'white' : '#B9B0A0',
});
const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#EDE6D8', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' };

export default function ChannelsTab({ guildId }: { guildId: string }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [scopes, setScopes] = useState<Record<string, ChannelScope>>({});
  const [openFeature, setOpenFeature] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const modeLabel: Record<ScopeMode, string> = { all: t('scope.all'), only: t('scope.only'), except: t('scope.except') };

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [scopeRes, chanRes] = await Promise.all([
        fetch(`/api/guilds/${guildId}/channelscopes`),
        fetch(`/api/guilds/${guildId}/channels`),
      ]);
      const scopeData = await scopeRes.json();
      const chanData = await chanRes.json();
      setChannels(Array.isArray(chanData) ? chanData : []);
      const normalized: Record<string, ChannelScope> = {};
      for (const [key, value] of Object.entries(scopeData.channelScopes || {})) {
        normalized[key] = normalizeScope(value as any);
      }
      setScopes(normalized);
    } catch (error) {
      console.debug('ChannelsTab: suppressed error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const categories = useMemo(() => channels.filter((c) => c.type === CHANNEL_TYPE_CATEGORY), [channels]);

  const nameOf = useMemo(() => {
    const map = new Map(channels.map((c) => [c.id, c]));
    return (id: string) => {
      const channel = map.get(id);
      if (!channel) return `? (${id})`;
      if (channel.type === CHANNEL_TYPE_CATEGORY) return `📁 ${channel.name}`;
      if (CHANNEL_TYPE_VOICE.includes(channel.type)) return `🔊 ${channel.name}`;
      return `# ${channel.name}`;
    };
  }, [channels]);

  const scopeOf = (key: string): ChannelScope => scopes[key] || { mode: 'all', channels: [] };

  const setMode = (key: string, mode: ScopeMode) => {
    setScopes((prev) => {
      const current = prev[key] || { mode: 'all', channels: [] };
      const next = { ...prev };
      if (mode === 'all') delete next[key];
      else next[key] = { mode, channels: current.channels };
      return next;
    });
  };

  const toggleChannel = (key: string, channelId: string) => {
    setScopes((prev) => {
      const current = prev[key] || { mode: 'only' as ScopeMode, channels: [] };
      const listed = current.channels.includes(channelId);
      const nextChannels = listed ? current.channels.filter((c) => c !== channelId) : [...current.channels, channelId];
      const next = { ...prev };
      if (current.mode === 'all' && nextChannels.length === 0) delete next[key];
      else next[key] = { mode: current.mode === 'all' ? 'only' : current.mode, channels: nextChannels };
      return next;
    });
  };

  const setAllChannels = (key: string, ids: string[], select: boolean) => {
    setScopes((prev) => {
      const current = prev[key] || { mode: 'only' as ScopeMode, channels: [] };
      return { ...prev, [key]: { mode: current.mode === 'all' ? 'only' : current.mode, channels: select ? ids : [] } };
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/channelscopes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelScopes: scopes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || t('cfg.common.saveFailed', { status: res.status }));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error('ChannelsTab: save failed', error);
      setSaveError(t('cfg.common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const pickableFor = (channelType: 'text' | 'voice' | 'any'): Channel[] => {
    if (channelType === 'text') return channels.filter((c) => CHANNEL_TYPE_TEXT.includes(c.type));
    if (channelType === 'voice') return channels.filter((c) => CHANNEL_TYPE_VOICE.includes(c.type));
    return channels.filter((c) => CHANNEL_TYPE_TEXT.includes(c.type) || CHANNEL_TYPE_VOICE.includes(c.type));
  };

  const visibleFeatures = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return FEATURES;
    return FEATURES.filter((f) => t(f.label).toLowerCase().includes(needle) || f.key.toLowerCase().includes(needle) || t(f.description).toLowerCase().includes(needle));
  }, [filter]);

  if (loading) return <p style={muted}>{t('common.loading')}</p>;

  const restrictedCount = Object.keys(scopes).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '12px' }}>
        <h3 style={{ color: 'white', fontWeight: 600 }}>📍 {t('scope.title')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={muted}>{restrictedCount === 0 ? t('scope.nothingRestricted') : `${t('scope.restricted')}: ${restrictedCount}`}</span>
          <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
        </div>
      </div>
      <p style={{ ...muted, marginBottom: '16px' }}>{t('scope.subtitle')}</p>

      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('common.search')} style={{ ...input, marginBottom: '16px' }} />

      <div style={{ ...card, marginBottom: '16px' }}>
        <p style={{ ...muted, marginBottom: '4px' }}>{t('scope.hintModes')}</p>
        <p style={muted}>{t('scope.hintCategory')}</p>
      </div>

      {FEATURE_GROUPS.map((group) => {
        const groupFeatures = visibleFeatures.filter((f) => f.group === group);
        if (groupFeatures.length === 0) return null;

        return (
          <div key={group} style={card}>
            <h3 style={h3}>{t(group)}</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {groupFeatures.map((feature) => {
                const scope = scopeOf(feature.key);
                const isOpen = openFeature === feature.key;
                const pickable = pickableFor(feature.channelType);

                return (
                  <div key={feature.key} style={{ border: '1px solid #2C271F', borderRadius: '8px', padding: '12px', backgroundColor: '#141517' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#EDE6D8', fontSize: '13px', fontWeight: 500 }}>{feature.emoji ? `${feature.emoji} ` : ''}{t(feature.label)}</div>
                        <div style={{ color: '#948C7C', fontSize: '11px' }}>{t(feature.description)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {(['all', 'only', 'except'] as ScopeMode[]).map((mode) => (
                          <button key={mode} type="button" onClick={() => setMode(feature.key, mode)} style={modeBtn(scope.mode === mode)}>
                            {modeLabel[mode]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {scope.mode !== 'all' && (
                      <div style={{ marginTop: '10px' }}>
                        <button type="button" onClick={() => setOpenFeature(isOpen ? null : feature.key)} style={{ color: '#14707A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>
                          {isOpen ? t('scope.hide') : t('scope.pick')}{scope.channels.length > 0 && ` (${scope.channels.length})`}
                        </button>

                        {scope.channels.length > 0 && !isOpen && (
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {scope.channels.map((id) => (
                              <span key={id} style={{ fontSize: '11px', backgroundColor: '#2C271F', color: '#EDE6D8', padding: '4px 8px', borderRadius: '4px' }}>{nameOf(id)}</span>
                            ))}
                          </div>
                        )}

                        {scope.mode === 'only' && scope.channels.length === 0 && (
                          <p style={{ marginTop: '8px', fontSize: '11px', color: '#D9A441' }}>{t('scope.emptyWarning')}</p>
                        )}

                        {isOpen && (
                          <>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                              <button type="button" onClick={() => setAllChannels(feature.key, pickable.map((c) => c.id), true)} style={{ color: '#14707A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>{t('common.selectAll')}</button>
                              <button type="button" onClick={() => setAllChannels(feature.key, [], false)} style={{ color: '#948C7C', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}>{t('common.clear')}</button>
                            </div>
                            <div style={{ marginTop: '8px', maxHeight: '280px', overflowY: 'auto', border: '1px solid #2C271F', borderRadius: '8px', padding: '8px', display: 'grid', gap: '10px' }}>
                              {categories.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#948C7C', marginBottom: '4px' }}>{t('scope.categories')}</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px' }}>
                                    {categories.map((c) => (
                                      <label key={c.id} style={chip}>
                                        <input type="checkbox" checked={scope.channels.includes(c.id)} onChange={() => toggleChannel(feature.key, c.id)} style={{ accentColor: '#14707A' }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {c.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#948C7C', marginBottom: '4px' }}>{t('scope.channels')}</div>
                                {pickable.length === 0 ? (
                                  <p style={{ ...muted, padding: '0 8px' }}>{t('scope.noChannels')}</p>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px' }}>
                                    {pickable.map((c) => (
                                      <label key={c.id} style={chip}>
                                        <input type="checkbox" checked={scope.channels.includes(c.id)} onChange={() => toggleChannel(feature.key, c.id)} style={{ accentColor: '#14707A' }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CHANNEL_TYPE_VOICE.includes(c.type) ? '🔊' : '#'} {c.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {saveError && <span style={{ color: '#E06C75', fontSize: '13px' }}>❌ {saveError}</span>}
        {!saveError && saved && <span style={{ color: '#6E8F4E', fontSize: '13px' }}>{t('common.saved')} ✓</span>}
        <button type="button" onClick={save} disabled={saving} style={{ ...btn, opacity: saving ? 0.6 : 1 }}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
