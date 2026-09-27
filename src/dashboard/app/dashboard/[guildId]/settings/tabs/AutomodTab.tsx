'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import ListInput from '../../../../components/ListInput';
import MultiSelect from '../../../../components/MultiSelect';
import type { SettingsTabProps } from './types';
import { useT } from '@/app/components/LanguageProvider';

type FieldKind = 'number' | 'action' | 'boolean';
type AnyObj = Record<string, any>;

interface FilterField {
  key: string;
  label: string;
  kind: FieldKind;
  fallback?: any;
  hint?: string;
}

interface FilterDefinition {
  key: string;
  label: string;
  desc: string;
  fields: FilterField[];
}

const ACTIONS = [
  { value: 'delete', label: 'automod.action.delete' },
  { value: 'warn', label: 'automod.action.warn' },
  { value: 'timeout', label: 'automod.action.timeout' },
  { value: 'kick', label: 'automod.action.kick' },
  { value: 'ban', label: 'automod.action.ban' },
];

const action = (fallback = 'delete'): FilterField => ({
  key: 'action', label: 'automod.field.action', kind: 'action', fallback,
});
const duration = (fallback = 300): FilterField => ({
  key: 'duration', label: 'automod.field.duration', kind: 'number', fallback,
  hint: 'automod.field.durationHint',
});

const FILTERS: FilterDefinition[] = [
  {
    key: 'spam',
    label: 'automod.spam.label',
    desc: 'automod.spam.desc',
    fields: [
      { key: 'maxMessages', label: 'automod.spam.maxMessages', kind: 'number', fallback: 5 },
      { key: 'interval', label: 'automod.spam.interval', kind: 'number', fallback: 5000, hint: 'automod.spam.intervalHint' },
      action('timeout'), duration(300),
    ],
  },
  {
    key: 'links',
    label: 'automod.links.label',
    desc: 'automod.links.desc',
    fields: [action('delete')],
  },
  {
    key: 'invites',
    label: 'automod.invites.label',
    desc: 'automod.invites.desc',
    fields: [action('delete')],
  },
  {
    key: 'caps',
    label: 'automod.caps.label',
    desc: 'automod.caps.desc',
    fields: [
      { key: 'percentage', label: 'automod.caps.percentage', kind: 'number', fallback: 70 },
      { key: 'minLength', label: 'automod.caps.minLength', kind: 'number', fallback: 10 },
      action('delete'),
    ],
  },
  {
    key: 'mentions',
    label: 'automod.mentions.label',
    desc: 'automod.mentions.desc',
    fields: [
      { key: 'maxMentions', label: 'automod.mentions.maxMentions', kind: 'number', fallback: 5 },
      action('timeout'), duration(300),
    ],
  },
  {
    key: 'repeated',
    label: 'automod.repeat.label',
    desc: 'automod.repeat.desc',
    fields: [
      { key: 'maxRepeats', label: 'automod.repeat.maxRepeats', kind: 'number', fallback: 3 },
      action('delete'),
    ],
  },
  {
    key: 'emojis',
    label: 'automod.emojis.label',
    desc: 'automod.emojis.desc',
    fields: [
      { key: 'maxEmojis', label: 'automod.emojis.maxEmojis', kind: 'number', fallback: 5 },
      action('delete'),
    ],
  },
  {
    key: 'spoilers',
    label: 'automod.spoilers.label',
    desc: 'automod.spoilers.desc',
    fields: [
      { key: 'maxSpoilers', label: 'automod.spoilers.maxSpoilers', kind: 'number', fallback: 3 },
      action('delete'),
    ],
  },
  {
    key: 'zalgo',
    label: 'automod.zalgo.label',
    desc: 'automod.zalgo.desc',
    fields: [action('delete')],
  },
  {
    key: 'phishing',
    label: 'automod.phishing.label',
    desc: 'automod.phishing.desc',
    fields: [action('ban'), duration(0)],
  },
  {
    key: 'fakeNitro',
    label: 'automod.fakeNitro.label',
    desc: 'automod.fakeNitro.desc',
    fields: [action('timeout'), duration(600)],
  },
  {
    key: 'cryptoScam',
    label: 'automod.cryptoScam.label',
    desc: 'automod.cryptoScam.desc',
    fields: [action('delete'), duration(0)],
  },
  {
    key: 'massMention',
    label: 'automod.massMention.label',
    desc: 'automod.massMention.desc',
    fields: [
      { key: 'maxMentions', label: 'automod.massMention.maxMentions', kind: 'number', fallback: 5 },
      { key: 'countEveryone', label: 'automod.massMention.countEveryone', kind: 'boolean', fallback: true },
      action('timeout'), duration(600),
    ],
  },
  {
    key: 'ghostPing',
    label: 'automod.ghostPing.label',
    desc: 'automod.ghostPing.desc',
    fields: [
      { key: 'maxAgeSeconds', label: 'automod.ghostPing.maxAgeSeconds', kind: 'number', fallback: 30 },
    ],
  },
  {
    key: 'attachments',
    label: 'cfg.automod.attachmentsTitle',
    desc: 'cfg.automod.attachmentsDesc',
    fields: [
      { key: 'maxAttachments', label: 'cfg.automod.maxAttachments', kind: 'number', fallback: 0 },
      { key: 'imagesOnly', label: 'cfg.automod.imagesOnly', kind: 'boolean', fallback: false },
      action('delete'),
    ],
  },
];

export default function AutomodTab({ ctx }: SettingsTabProps) {
  const { cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;
  const t = useT();

  const am = settings.automod || {};
  const get = (branch: string, key: string, fallback: any) => {
    const value = am?.[branch]?.[key];
    return value === undefined || value === null ? fallback : value;
  };
  const escRules: AnyObj[] = am.escalation?.rules || [];

  const sectionTitle = { color: 'white', marginBottom: '12px', fontWeight: '600' as const };
  const hintStyle = { color: '#948C7C', fontSize: '11px', marginTop: '4px' };

  return (
    <>
      <div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={sectionTitle}>🛡️ {t('nav.automod')}</h3>
            <input
              type="checkbox"
              checked={am.enabled || false}
              onChange={() => updateSettings('automod.enabled', !am.enabled)}
              style={{ accentColor: '#14707A', width: '20px', height: '20px' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EDE6D8', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={am.ignoreAdmins !== false}
              onChange={() => updateSettings('automod.ignoreAdmins', am.ignoreAdmins === false)}
              style={{ accentColor: '#14707A' }}
            />
            {t('tabsA.automod.ignoreAdmins')}
          </label>
        </div>

        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('tabsA.automod.exemptTitle')}</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('automod.exemptRoles')}</label>
              <MultiSelect
                items={roles}
                value={am.bypassRoles || []}
                onChange={(v) => updateSettings('automod.bypassRoles', v)}
                placeholder={t('tabsA.automod.searchRole')}
                emptyLabel={t('tabsA.automod.noExemptRole')}
                prefix="@"
              />
            </div>
            <div>
              <label style={labelStyle}>{t('automod.exemptChannels')}</label>
              <MultiSelect
                items={textChannels}
                value={am.ignoredChannels || []}
                onChange={(v) => updateSettings('automod.ignoredChannels', v)}
                placeholder={t('tabsA.automod.searchChannel')}
                emptyLabel={t('tabsA.automod.allChannels')}
                prefix="#"
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('tabsA.automod.bannedWords')}</h3>
          <ListInput
            value={am.blacklist || []}
            onChange={(v) => updateSettings('automod.blacklist', v)}
            rows={5}
            style={inputStyle}
            placeholder={t('tabsA.automod.bannedWordsPlaceholder')}
          />
          <div style={hintStyle}>
            {t('tabsA.automod.bannedWordsHint')}
          </div>
          <div style={{ marginTop: '12px', maxWidth: '260px' }}>
            <label style={labelStyle}>{t('automod.field.action')}</label>
            <select
              value={am.blacklist_action || 'delete'}
              onChange={(e) => updateSettings('automod.blacklist_action', e.target.value)}
              style={inputStyle}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{t(a.label)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('tabsA.automod.allowedDomains')}</h3>
          <ListInput
            value={am.links?.whitelist || []}
            onChange={(v) => updateSettings('automod.links.whitelist', v)}
            rows={4}
            style={inputStyle}
            placeholder="youtube.com, github.com"
          />
          <div style={hintStyle}>
            {t('tabsA.automod.allowedDomainsHint')}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('tabsA.automod.filters')}</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {FILTERS.map((filter) => {
              const branch = am[filter.key] || {};
              const on = branch.enabled === true;
              return (
                <div
                  key={filter.key}
                  style={{ backgroundColor: '#1B1815', borderRadius: '8px', padding: '12px', border: '1px solid #2A251F' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#EDE6D8', fontSize: '13px', fontWeight: 500 }}>{t(filter.label)}</div>
                      <div style={{ color: '#948C7C', fontSize: '11px' }}>{t(filter.desc)}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => updateSettings(`automod.${filter.key}.enabled`, !on)}
                      style={{ accentColor: '#14707A', width: '18px', height: '18px' }}
                    />
                  </div>

                  {on && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '10px',
                        marginTop: '12px',
                      }}
                    >
                      {filter.fields.map((field) => {
                        const path = `automod.${filter.key}.${field.key}`;
                        const current = get(filter.key, field.key, field.fallback);

                        if (field.kind === 'boolean') {
                          return (
                            <label
                              key={field.key}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EDE6D8', fontSize: '13px' }}
                            >
                              <input
                                type="checkbox"
                                checked={current !== false}
                                onChange={() => updateSettings(path, current === false)}
                                style={{ accentColor: '#14707A' }}
                              />
                              {t(field.label)}
                            </label>
                          );
                        }

                        if (field.kind === 'action') {
                          return (
                            <div key={field.key}>
                              <label style={labelStyle}>{t(field.label)}</label>
                              <select
                                value={current}
                                onChange={(e) => updateSettings(path, e.target.value)}
                                style={inputStyle}
                              >
                                {ACTIONS.map((a) => (
                                  <option key={a.value} value={a.value}>{t(a.label)}</option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        return (
                          <div key={field.key}>
                            <label style={labelStyle}>{t(field.label)}</label>
                            <input
                              type="number"
                              value={current}
                              onChange={(e) => updateSettings(path, parseInt(e.target.value, 10) || 0)}
                              style={inputStyle}
                            />
                            {field.hint && <div style={hintStyle}>{t(field.hint)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('cfg.automod.escalationTitle')}</h3>
          <p style={{ color: '#948C7C', fontSize: '11px', marginBottom: '12px' }}>{t('cfg.automod.escalationDesc')}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EDE6D8', fontSize: '13px', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={!!am.escalation?.enabled}
              onChange={() => updateSettings('automod.escalation.enabled', !am.escalation?.enabled)}
              style={{ accentColor: '#14707A' }}
            />
            {t('cfg.automod.escalationEnable')}
          </label>
          {am.escalation?.enabled && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ maxWidth: '200px' }}>
                <label style={labelStyle}>{t('cfg.automod.windowMinutes')}</label>
                <input
                  type="number"
                  value={am.escalation?.windowMinutes ?? 60}
                  onChange={(e) => updateSettings('automod.escalation.windowMinutes', parseInt(e.target.value, 10) || 0)}
                  style={inputStyle}
                />
              </div>
              {escRules.map((r: AnyObj, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', backgroundColor: '#1B1815', borderRadius: '8px', padding: '10px' }}>
                  <span style={{ color: '#948C7C', fontSize: '11px' }}>{t('cfg.automod.after')}</span>
                  <input
                    type="number"
                    value={r.infractions ?? 3}
                    onChange={(e) => { const next = [...escRules]; next[i] = { ...r, infractions: parseInt(e.target.value, 10) || 0 }; updateSettings('automod.escalation.rules', next); }}
                    style={{ ...inputStyle, width: '70px' }}
                  />
                  <span style={{ color: '#948C7C', fontSize: '11px' }}>{t('cfg.automod.infractions')} →</span>
                  <select
                    value={r.action || 'timeout'}
                    onChange={(e) => { const next = [...escRules]; next[i] = { ...r, action: e.target.value }; updateSettings('automod.escalation.rules', next); }}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    {ACTIONS.filter((a) => a.value !== 'delete' && a.value !== 'warn').map((a) => (
                      <option key={a.value} value={a.value}>{t(a.label)}</option>
                    ))}
                  </select>
                  {(r.action === 'timeout' || !r.action) && (
                    <>
                      <input
                        type="number"
                        value={r.duration ?? 600}
                        onChange={(e) => { const next = [...escRules]; next[i] = { ...r, duration: parseInt(e.target.value, 10) || 0 }; updateSettings('automod.escalation.rules', next); }}
                        style={{ ...inputStyle, width: '80px' }}
                      />
                      <span style={{ color: '#948C7C', fontSize: '11px' }}>{t('cfg.automod.secShort')}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => updateSettings('automod.escalation.rules', escRules.filter((_: AnyObj, j: number) => j !== i))}
                    style={{ marginLeft: 'auto', color: '#f23f43', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateSettings('automod.escalation.rules', [...escRules, { infractions: 3, action: 'timeout', duration: 600 }])}
                style={{ color: '#14707A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}
              >
                {t('cfg.automod.addRule')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
