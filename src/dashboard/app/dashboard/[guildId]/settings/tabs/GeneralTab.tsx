'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { MODULES, MODULE_GROUPS } from '../../../../../lib/moduleRegistry';
import { useT } from '../../../../components/LanguageProvider';
import { moduleEnabled } from '../../../../../lib/channelScope';
import type { SettingsTabProps } from './types';
import { LANGUAGES } from '@/lib/languages';

// A module's configPath names the settings tab where it's configured in
// detail. A few configPath values use a different spelling than the tab id
// they mean.
const TAB_ALIASES: Record<string, string> = { logs: 'logging', social: 'socials' };

export default function GeneralTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, setActiveTab, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsA.general.basicTitle')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t('tabsA.general.prefix')}</label>
                    <input type="text" value={settings.prefix || '!'} onChange={(e) => updateSettings('prefix', e.target.value)} style={{ ...inputStyle, width: '80px' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('tabsA.general.botLanguage')}</label>
                    <select value={settings.language || 'en'} onChange={(e) => updateSettings('language', e.target.value)} style={inputStyle}>
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                      ))}
                    </select>
                    <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '4px' }}>{t('tabsA.general.botLanguageHint')}</p>
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>{t('tabsA.general.botNickname')}</label>
                  <input
                    type="text"
                    maxLength={32}
                    value={settings.botNickname || ''}
                    onChange={(e) => updateSettings('botNickname', e.target.value)}
                    placeholder={t('tabsA.general.botNicknamePlaceholder')}
                    style={inputStyle}
                  />
                  <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '4px' }}>
                    {t('tabsA.general.botNicknameHint')}
                  </p>
                </div>
                <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#6E8F4E20', border: '1px solid #6E8F4E', borderRadius: '6px' }}>
                  <p style={{ color: '#6E8F4E', fontSize: '12px', margin: 0 }}>
                    {t('tabsA.general.perServerNote')}
                  </p>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>{t('tabsA.general.managerRole')}</label>
                  <select value={settings.managerRoleId || ''} onChange={(e) => updateSettings('managerRoleId', e.target.value)} style={inputStyle}>
                    <option value="">{t('tabsA.common.none')}</option>
                    {roles.map((r: { id: string; name: string }) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '4px' }}>{t('tabsA.general.managerRoleHint')}</p>
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('nav.modules')}</h3>
                  <span style={{ color: '#948C7C', fontSize: '12px' }}>
                    {t('tabsA.general.modulesEnabled', { on: MODULES.filter(m => moduleEnabled(settings.modules?.[m.key], m.defaultEnabled)).length, total: MODULES.length })}
                  </span>
                </div>
                <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '16px' }}>
                  {t('tabsA.general.modulesIntro')}
                </p>

                {MODULE_GROUPS.map(group => {
                  const groupModules = MODULES.filter(m => m.group === group);
                  if (groupModules.length === 0) return null;

                  return (
                    <div key={group} style={{ marginBottom: '20px' }}>
                      <div style={{ color: '#948C7C', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        {t(group)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                        {groupModules.map(mod => {
                          const on = moduleEnabled(settings.modules?.[mod.key], mod.defaultEnabled);
                          return (
                            <label
                              key={mod.key}
                              title={t(mod.description)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px',
                                backgroundColor: '#1B1815', borderRadius: '6px', cursor: 'pointer',
                                border: `1px solid ${on ? '#14707A' : '#221E19'}`
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => updateSettings(`modules.${mod.key}.enabled`, !on)}
                                style={{ accentColor: '#14707A', marginTop: '2px' }}
                              />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ color: '#EDE6D8', fontSize: '12px', display: 'block' }}>
                                  {mod.emoji} {t(mod.label)}
                                </span>
                                <span style={{ color: '#948C7C', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                                  {t(mod.description)}
                                </span>
                                {mod.configPath && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab(TAB_ALIASES[mod.configPath] || mod.configPath); }}
                                    style={{ color: '#14707A', fontSize: '10px', marginTop: '4px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                  >
                                    {t('nav.settings')} →
                                  </button>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #2C271F', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('channels')}
                  style={{ ...inputStyle, width: 'auto', display: 'inline-block', textDecoration: 'none', fontSize: '12px', cursor: 'pointer' }}
                >
                  {t('nav.channels')} →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('links')}
                  style={{ ...inputStyle, width: 'auto', display: 'inline-block', textDecoration: 'none', fontSize: '12px', cursor: 'pointer' }}
                >
                  {t('nav.links')} →
                </button>
              </div>
            </div>
    </>
  );
}
