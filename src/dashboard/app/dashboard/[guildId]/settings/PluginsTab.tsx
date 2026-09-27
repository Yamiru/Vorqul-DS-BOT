'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage, useT } from '../../../components/LanguageProvider';
import { TabToolbar } from '../../../components/TabToolbar';
import { localize, type GuildValues, type PluginSettingField, type SettingValue } from '../../../../../shared/pluginManifest';
import GuildPluginSettings from './GuildPluginSettings';

type PluginState = 'running' | 'disabled' | 'restart_enable' | 'restart_disable' | 'error' | 'invalid' | 'unknown';

interface PluginRow {
  folder: string;
  name: string;
  valid: boolean;
  error?: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  homepage?: string;
  github?: string;
  license?: string;
  state: PluginState;
  commands: string[];
  events: number;
  runtimeError?: string;
  hasDependencies: boolean;
  settings: { fields: PluginSettingField[]; values: Record<string, SettingValue> };
  guildSettings: { fields: PluginSettingField[]; values: GuildValues };
}

interface PluginData {
  canManage: boolean;
  ownerConfigured: boolean;
  botStatusKnown: boolean;
  plugins: PluginRow[];
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const card: React.CSSProperties = { backgroundColor: '#221E19', borderRadius: '12px', padding: '18px', border: '1px solid #3A332A', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' };
const h3: React.CSSProperties = { color: 'white', marginBottom: '10px', fontWeight: 600, fontSize: '15px' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };
const input: React.CSSProperties = { backgroundColor: '#1B1815', border: '1px solid #3A332A', borderRadius: '6px', color: 'white', padding: '8px 10px', width: '100%' };
const primary: React.CSSProperties = { backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const ghost: React.CSSProperties = { background: 'none', border: '1px solid #3A332A', color: '#EDE6D8', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer' };
const danger: React.CSSProperties = { background: 'none', border: '1px solid #D06450', color: '#D06450', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer' };

const STATE_COLORS: Record<PluginState, string> = {
  running: '#4CAF7A',
  disabled: '#948C7C',
  restart_enable: '#D9A441',
  restart_disable: '#D9A441',
  error: '#D06450',
  invalid: '#D06450',
  unknown: '#14707A'
};

export default function PluginsTab({ guildId }: { guildId: string }) {
  const t = useT();
  const { language } = useLanguage();
  const [data, setData] = useState<PluginData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [openGuild, setOpenGuild] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [replace, setReplace] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const base = `/api/guilds/${guildId}/plugins`;

  const describeError = useCallback(
    (json: any, status: number): string => {
      const code = String(json?.error || '');
      const key = `plg.err.${code}`;
      const translated = t(key);
      if (code && translated !== key) {
        return code === 'bad_manifest' && json?.message ? `${translated} (${String(json.message)})` : translated;
      }
      return json?.message ? String(json.message) : t('plg.err.generic', { status });
    },
    [t]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setData(await res.json());
      setLoadError(false);
    } catch (error) {
      console.debug('PluginsTab: load failed', error);
      setLoadError(true);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (name: string, init: RequestInit, success: string) => {
    setBusy(name);
    setNotice(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(name)}`, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: 'error', text: describeError(json, res.status) });
        return false;
      }
      setNotice({ kind: 'ok', text: success });
      await load();
      return true;
    } catch (error) {
      console.debug('PluginsTab: request failed', error);
      setNotice({ kind: 'error', text: t('plg.err.network') });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (plugin: PluginRow) =>
    send(
      plugin.name,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !plugin.enabled }) },
      t(plugin.enabled ? 'plg.disabledDone' : 'plg.enabledDone', { name: plugin.name })
    );

  const uninstall = async (plugin: PluginRow) => {
    if (!window.confirm(t('plg.removeConfirm', { name: plugin.name }))) return;
    if (await send(plugin.name, { method: 'DELETE' }, t('plg.removed', { name: plugin.name }))) {
      if (openSettings === plugin.name) setOpenSettings(null);
    }
  };

  const openForm = (plugin: PluginRow) => {
    if (openSettings === plugin.name) {
      setOpenSettings(null);
      return;
    }
    const initial: Record<string, string | boolean> = {};
    for (const field of plugin.settings.fields) {
      const value = plugin.settings.values[field.key];
      initial[field.key] = field.type === 'boolean' ? value === true : String(value ?? '');
    }
    setForm(initial);
    setOpenSettings(plugin.name);
  };

  const saveSettings = async (plugin: PluginRow) => {
    const values: Record<string, SettingValue> = {};
    for (const field of plugin.settings.fields) {
      const raw = form[field.key];
      values[field.key] = field.type === 'boolean' ? raw === true : field.type === 'number' ? Number(raw) : String(raw ?? '');
    }
    await send(
      plugin.name,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: values }) },
      t('plg.saved')
    );
  };

  const install = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setNotice({ kind: 'error', text: t('plg.err.no_file') });
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('replace', replace ? 'true' : 'false');
    setBusy('__install');
    setNotice(null);
    try {
      const res = await fetch(base, { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: 'error', text: describeError(json, res.status) });
        return;
      }
      const parts = [t(json.replaced ? 'plg.install.updated' : 'plg.install.done', { name: json.name, version: json.version })];
      if (json.hasDependencies) parts.push(t('plg.install.deps'));
      setNotice({ kind: 'ok', text: parts.join(' ') });
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
      await load();
    } catch (error) {
      console.debug('PluginsTab: install failed', error);
      setNotice({ kind: 'error', text: t('plg.err.network') });
    } finally {
      setBusy(null);
    }
  };

  if (loadError) return <div style={card}><p style={{ color: '#D06450' }}>{t('plg.loadFailed')}</p></div>;
  if (!data) return <div style={card}><p style={muted}>{t('plg.loading')}</p></div>;

  const needsRestart = data.plugins.some((p) => p.state === 'restart_enable' || p.state === 'restart_disable');

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px' }}>
          <h3 style={{ ...h3, marginBottom: 0 }}>{t('plg.title')}</h3>
          <TabToolbar onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing} />
        </div>
        <p style={{ ...muted, marginBottom: '10px' }}>{t('plg.intro')}</p>
        {!data.canManage && (
          <p style={{ ...muted, color: '#D9A441' }}>
            {data.ownerConfigured ? t('plg.ownerOnly') : t('plg.ownerMissing')}
          </p>
        )}
        {data.canManage && <p style={{ ...muted, color: '#D9A441' }}>{t('plg.warning')}</p>}
        {!data.botStatusKnown && <p style={{ ...muted, marginTop: '8px' }}>{t('plg.statusUnknown')}</p>}
      </div>

      {notice && (
        <div style={{ ...card, borderColor: notice.kind === 'ok' ? '#4CAF7A' : '#D06450', color: notice.kind === 'ok' ? '#4CAF7A' : '#D06450', fontSize: '13px' }}>
          {notice.text}
        </div>
      )}

      {needsRestart && (
        <div style={{ ...card, borderColor: '#D9A441', color: '#D9A441', fontSize: '13px' }}>{t('plg.restartNeeded')}</div>
      )}

      {data.canManage && (
        <div style={card}>
          <h3 style={h3}>{t('plg.install.title')}</h3>
          <p style={{ ...muted, marginBottom: '12px' }}>{t('plg.install.hint')}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
              style={{ display: 'none' }}
              id="plugin-file"
            />
            <label htmlFor="plugin-file" style={{ ...ghost, display: 'inline-block' }}>{t('plg.install.choose')}</label>
            <span style={{ ...muted, flex: '1 1 160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName || t('plg.install.noFile')}</span>
            <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> {t('plg.install.replace')}
            </label>
            <button style={{ ...primary, opacity: busy === '__install' ? 0.6 : 1 }} onClick={install} disabled={busy === '__install'}>
              {busy === '__install' ? t('plg.install.installing') : t('plg.install.button')}
            </button>
          </div>
        </div>
      )}

      {data.plugins.length === 0 && <div style={card}><p style={muted}>{t('plg.empty')}</p></div>}

      {data.plugins.map((plugin) => {
        const color = STATE_COLORS[plugin.state];
        const working = busy === plugin.name;
        return (
          <div key={plugin.folder} style={{ ...card, borderColor: plugin.state.startsWith('restart') ? '#D9A441' : '#3A332A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{plugin.name}</span>
                  {plugin.valid && <span style={{ ...muted, fontFamily: 'monospace' }}>{t('plg.version', { version: plugin.version })}</span>}
                  <span style={{ border: `1px solid ${color}`, color, borderRadius: '999px', padding: '1px 9px', fontSize: '11px' }}>
                    {t(`plg.state.${plugin.state}`)}
                  </span>
                </div>
                {plugin.valid && plugin.author && <div style={muted}>{t('plg.by', { author: plugin.author })}{plugin.license ? ` · ${plugin.license}` : ''}</div>}
                {plugin.description && <p style={{ color: '#EDE6D8', fontSize: '13px', margin: '8px 0' }}>{plugin.description}</p>}
                {!plugin.valid && <p style={{ color: '#D06450', fontSize: '12px', margin: '8px 0' }}>{plugin.error}</p>}
                {plugin.state === 'error' && plugin.runtimeError && (
                  <p style={{ color: '#D06450', fontSize: '12px', margin: '8px 0' }}>{plugin.runtimeError}</p>
                )}
                {plugin.commands.length > 0 && (
                  <div style={{ ...muted, marginTop: '6px' }}>
                    {t('plg.commands')}: {plugin.commands.map((c) => <code key={c} style={{ marginRight: '6px', color: '#EDE6D8' }}>/{c}</code>)}
                    {plugin.events > 0 && <span> · {t('plg.events', { n: plugin.events })}</span>}
                  </div>
                )}
                <div style={{ ...muted, marginTop: '6px', display: 'flex', gap: '12px' }}>
                  {plugin.homepage && <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" style={{ color: '#14707A' }}>{t('plg.homepage')}</a>}
                  {plugin.github && <a href={plugin.github} target="_blank" rel="noopener noreferrer" style={{ color: '#14707A' }}>{t('plg.source')}</a>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', opacity: working ? 0.6 : 1 }}>
                {plugin.valid && plugin.guildSettings.fields.length > 0 && (
                  <button style={primary} disabled={working} onClick={() => setOpenGuild(openGuild === plugin.name ? null : plugin.name)}>
                    {openGuild === plugin.name ? t('plg.guild.close') : t('plg.guild.open')}
                  </button>
                )}
              </div>

              {data.canManage && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', opacity: working ? 0.6 : 1 }}>
                  {plugin.valid && (
                    <button style={ghost} disabled={working} onClick={() => toggle(plugin)}>
                      {plugin.enabled ? t('plg.disable') : t('plg.enable')}
                    </button>
                  )}
                  {plugin.valid && plugin.settings.fields.length > 0 && (
                    <button style={ghost} disabled={working} onClick={() => openForm(plugin)}>
                      {openSettings === plugin.name ? t('plg.settingsClose') : t('plg.settings')}
                    </button>
                  )}
                  <button style={danger} disabled={working} onClick={() => uninstall(plugin)}>{t('plg.remove')}</button>
                </div>
              )}
            </div>

            {plugin.valid && plugin.guildSettings.fields.length > 0 && openGuild === plugin.name && (
              <GuildPluginSettings key={plugin.name} guildId={guildId} plugin={plugin} onSaved={load} />
            )}

            {data.canManage && openSettings === plugin.name && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #3A332A', display: 'grid', gap: '14px' }}>
                <p style={muted}>{t('plg.settingsHint')}</p>
                {plugin.settings.fields.map((field) => (
                  <div key={field.key}>
                    {field.type === 'boolean' ? (
                      <label style={{ color: '#EDE6D8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={form[field.key] === true} onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })} />
                        {localize(field.label, language)}
                      </label>
                    ) : (
                      <label style={{ color: '#EDE6D8', fontSize: '13px', display: 'block' }}>
                        <span style={{ display: 'block', marginBottom: '5px' }}>{localize(field.label, language)}</span>
                        {field.type === 'select' ? (
                          <select style={input} value={String(form[field.key] ?? '')} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                            {(field.options || []).map((option) => (
                              <option key={option.value} value={option.value}>{localize(option.label, language)}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            style={input}
                            type={field.type === 'number' ? 'number' : 'text'}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            maxLength={field.type === 'string' ? field.maxLength : undefined}
                            value={String(form[field.key] ?? '')}
                            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                          />
                        )}
                      </label>
                    )}
                    {field.description && <div style={{ ...muted, marginTop: '4px' }}>{localize(field.description, language)}</div>}
                  </div>
                ))}
                <div>
                  <button style={{ ...primary, opacity: working ? 0.6 : 1 }} disabled={working} onClick={() => saveSettings(plugin)}>
                    {working ? t('plg.saving') : t('plg.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
