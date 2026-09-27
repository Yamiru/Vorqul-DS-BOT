'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useState } from 'react';
import { useLanguage, useT } from '../../../components/LanguageProvider';
import {
  localize,
  effectiveDefault,
  effectiveMaxItems,
  effectiveMin,
  type GuildRecord,
  type GuildValues,
  type PluginSettingField,
  type SettingValue
} from '../../../../../shared/pluginManifest';

type Raw = string | boolean;
type RawItem = Record<string, Raw>;
type FormState = Record<string, Raw | RawItem[]>;

interface Channel {
  id: string;
  name: string;
  type: number;
}

export interface GuildPluginInfo {
  name: string;
  state: string;
  settings: { values: Record<string, SettingValue> };
  guildSettings: { fields: PluginSettingField[]; values: GuildValues };
}

const card: React.CSSProperties = { backgroundColor: '#1B1815', borderRadius: '10px', padding: '14px', border: '1px solid #3A332A', borderLeft: '3px solid #14707A', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' };
const muted: React.CSSProperties = { color: '#948C7C', fontSize: '12px' };
const input: React.CSSProperties = { backgroundColor: '#14120F', border: '1px solid #3A332A', borderRadius: '6px', color: 'white', padding: '8px 10px', width: '100%' };
const primary: React.CSSProperties = { backgroundColor: '#14707A', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const ghost: React.CSSProperties = { background: 'none', border: '1px solid #3A332A', color: '#EDE6D8', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };
const danger: React.CSSProperties = { background: 'none', border: '1px solid #D06450', color: '#D06450', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' };
const errorText: React.CSSProperties = { color: '#D06450', fontSize: '12px', marginTop: '4px' };

const TEXT_TYPES = new Set([0, 5]);
const VOICE_TYPES = new Set([2, 13]);

function toRaw(field: PluginSettingField, value: unknown): Raw {
  if (field.type === 'boolean') return value === true;
  return value === null || value === undefined ? '' : String(value);
}

function toItem(fields: PluginSettingField[], source: Record<string, unknown>): RawItem {
  const item: RawItem = {};
  if (typeof source.id === 'string') item.id = source.id;
  for (const inner of fields) item[inner.key] = toRaw(inner, source[inner.key]);
  return item;
}

function initForm(fields: PluginSettingField[], values: GuildValues): FormState {
  const form: FormState = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'list') {
      form[field.key] = (Array.isArray(value) ? value : []).map((item) => toItem(field.fields ?? [], item as GuildRecord));
    } else {
      form[field.key] = toRaw(field, value);
    }
  }
  return form;
}

function payloadValue(field: PluginSettingField, raw: Raw | undefined): unknown {
  if (field.type === 'boolean') return raw === true;
  if (field.type === 'number') return raw === '' || raw === undefined ? null : Number(raw);
  return typeof raw === 'string' ? raw : '';
}

function toPayload(fields: PluginSettingField[], form: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'list') {
      out[field.key] = ((form[field.key] as RawItem[]) || []).map((item) => {
        const row: Record<string, unknown> = {};
        if (item.id) row.id = item.id;
        for (const inner of field.fields ?? []) row[inner.key] = payloadValue(inner, item[inner.key]);
        return row;
      });
    } else {
      out[field.key] = payloadValue(field, form[field.key] as Raw);
    }
  }
  return out;
}

interface ControlProps {
  field: PluginSettingField;
  value: Raw | undefined;
  onChange: (value: Raw) => void;
  error?: string;
  channels: Channel[];
  globals: Record<string, SettingValue>;
}

function Control({ field, value, onChange, error, channels, globals }: ControlProps) {
  const t = useT();
  const { language } = useLanguage();
  const label = `${localize(field.label, language)}${field.required ? ' *' : ''}`;
  const description = field.description ? <div style={{ ...muted, marginTop: '4px' }}>{localize(field.description, language)}</div> : null;
  const problem = error ? <div style={errorText}>{t(`plg.fieldErr.${error}`)}</div> : null;

  if (field.type === 'boolean') {
    return (
      <div>
        <label style={{ color: '#EDE6D8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {label}
        </label>
        {description}
        {problem}
      </div>
    );
  }

  let control: React.ReactNode;
  if (field.type === 'select') {
    control = (
      <select style={input} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>{localize(option.label, language)}</option>
        ))}
      </select>
    );
  } else if (field.type === 'channel') {
    const kinds = field.kinds ?? ['text'];
    const usable = channels.filter((c) => (kinds.includes('text') && TEXT_TYPES.has(c.type)) || (kinds.includes('voice') && VOICE_TYPES.has(c.type)));
    const current = String(value ?? '');
    const known = usable.some((c) => c.id === current);
    control = (
      <select style={input} value={current} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.required ? t('plg.guild.chooseChannel') : t('plg.guild.noChannel')}</option>
        {current && !known && <option value={current}>{current}</option>}
        {usable.map((c) => (
          <option key={c.id} value={c.id}>{VOICE_TYPES.has(c.type) ? '🔊 ' : '# '}{c.name}</option>
        ))}
      </select>
    );
  } else if (field.type === 'number') {
    control = (
      <input
        style={input}
        type="number"
        min={effectiveMin(field, globals) ?? field.min}
        max={field.max}
        step={field.step}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else {
    control = <input style={input} type="text" maxLength={field.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <label style={{ color: '#EDE6D8', fontSize: '13px', display: 'block' }}>
      <span style={{ display: 'block', marginBottom: '5px' }}>{label}</span>
      {control}
      {description}
      {problem}
    </label>
  );
}

export default function GuildPluginSettings({ guildId, plugin, onSaved }: { guildId: string; plugin: GuildPluginInfo; onSaved: () => Promise<void> | void }) {
  const t = useT();
  const { language } = useLanguage();
  const fields = plugin.guildSettings.fields;
  const globals = plugin.settings.values;
  const [form, setForm] = useState<FormState>(() => initForm(fields, plugin.guildSettings.values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guilds/${guildId}/channels`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (!cancelled) setChannels(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const setScalar = (key: string, value: Raw) => setForm((current) => ({ ...current, [key]: value }));
  const setItem = (key: string, index: number, inner: string, value: Raw) =>
    setForm((current) => ({
      ...current,
      [key]: (current[key] as RawItem[]).map((item, i) => (i === index ? { ...item, [inner]: value } : item))
    }));
  const addItem = (field: PluginSettingField) =>
    setForm((current) => {
      const item: RawItem = {};
      for (const inner of field.fields ?? []) item[inner.key] = toRaw(inner, effectiveDefault(inner, globals));
      return { ...current, [field.key]: [...((current[field.key] as RawItem[]) || []), item] };
    });
  const removeItem = (key: string, index: number) =>
    setForm((current) => ({ ...current, [key]: (current[key] as RawItem[]).filter((_, i) => i !== index) }));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch(`/api/guilds/${guildId}/plugins/${encodeURIComponent(plugin.name)}/guild`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: toPayload(fields, form) })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === 'invalid_settings' && json.fields) {
          setErrors(json.fields);
          setMessage({ kind: 'error', text: t('plg.guild.hasErrors') });
        } else {
          const key = `plg.err.${json?.error}`;
          const translated = t(key);
          setMessage({ kind: 'error', text: translated !== key ? translated : t('plg.err.generic', { status: res.status }) });
        }
        return;
      }
      setForm(initForm(fields, json.values));
      setMessage({ kind: 'ok', text: t('plg.guild.saved') });
      await onSaved();
    } catch (error) {
      console.debug('GuildPluginSettings: save failed', error);
      setMessage({ kind: 'error', text: t('plg.err.network') });
    } finally {
      setSaving(false);
    }
  };

  const channelList = channels ?? [];

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #3A332A', display: 'grid', gap: '14px' }}>
      <div>
        <div style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{t('plg.guild.title')}</div>
        <p style={muted}>{t('plg.guild.hint')}</p>
        {plugin.state !== 'running' && <p style={{ ...muted, color: '#D9A441' }}>{t('plg.guild.notRunning')}</p>}
        {channels !== null && channels.length === 0 && <p style={{ ...muted, color: '#D06450' }}>{t('plg.guild.noChannels')}</p>}
      </div>

      {fields.map((field) => {
        if (field.type !== 'list') {
          return (
            <Control key={field.key} field={field} value={form[field.key] as Raw} onChange={(v) => setScalar(field.key, v)} error={errors[field.key]} channels={channelList} globals={globals} />
          );
        }

        const items = (form[field.key] as RawItem[]) || [];
        const limit = effectiveMaxItems(field, globals);
        const listError = errors[field.key];
        return (
          <div key={field.key} style={{ display: 'grid', gap: '10px' }}>
            <div>
              <div style={{ color: '#EDE6D8', fontSize: '13px', fontWeight: 600 }}>{localize(field.label, language)}</div>
              {field.description && <div style={muted}>{localize(field.description, language)}</div>}
            </div>
            {listError && <div style={errorText}>{t(`plg.fieldErr.${listError}`)}</div>}
            {items.length === 0 && <div style={muted}>{t('plg.guild.empty')}</div>}
            {items.map((item, index) => {
              const title = (field.itemTitleKey && typeof item[field.itemTitleKey] === 'string' && (item[field.itemTitleKey] as string).trim()) || t('plg.guild.itemFallback', { n: index + 1 });
              const itemError = errors[`${field.key}[${index}]`];
              return (
                <div key={String(item.id ?? `new-${index}`)} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{title}</span>
                    <button style={danger} onClick={() => removeItem(field.key, index)}>{t('plg.guild.removeItem')}</button>
                  </div>
                  {itemError && <div style={errorText}>{t(`plg.fieldErr.${itemError}`)}</div>}
                  <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                    {(field.fields ?? []).map((inner) => (
                      <Control
                        key={inner.key}
                        field={inner}
                        value={item[inner.key]}
                        onChange={(v) => setItem(field.key, index, inner.key, v)}
                        error={errors[`${field.key}[${index}].${inner.key}`]}
                        channels={channelList}
                        globals={globals}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button style={{ ...ghost, opacity: items.length >= limit ? 0.5 : 1 }} disabled={items.length >= limit} onClick={() => addItem(field)}>
                {t('plg.guild.add')}
              </button>
              <span style={muted}>{items.length >= limit ? t('plg.guild.limit', { n: limit }) : `${items.length}/${limit}`}</span>
            </div>
          </div>
        );
      })}

      {message && <div style={{ color: message.kind === 'ok' ? '#4CAF7A' : '#D06450', fontSize: '13px' }}>{message.text}</div>}
      <div>
        <button style={{ ...primary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>
          {saving ? t('plg.saving') : t('plg.guild.save')}
        </button>
      </div>
    </div>
  );
}
