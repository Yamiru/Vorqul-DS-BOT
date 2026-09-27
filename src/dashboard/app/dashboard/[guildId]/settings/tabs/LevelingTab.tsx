'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import MultiSelect from '../../../../components/MultiSelect';
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function LevelingTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnSecondary, cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.leveling.title')}</h3>
                  <input type="checkbox" checked={settings.leveling?.enabled || false} onChange={() => updateSettings('leveling.enabled', !settings.leveling?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.leveling.xpMin')}</label><input type="number" value={settings.leveling?.xpMin || 15} onChange={(e) => updateSettings('leveling.xpMin', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.xpMax')}</label><input type="number" value={settings.leveling?.xpMax || 25} onChange={(e) => updateSettings('leveling.xpMax', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.cooldown')}</label><input type="number" value={settings.leveling?.xpCooldown || 60} onChange={(e) => updateSettings('leveling.xpCooldown', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.voiceXpPerMin')}</label><input type="number" value={settings.leveling?.voiceXpPerMinute || 5} onChange={(e) => updateSettings('leveling.voiceXpPerMinute', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.multiplier')}</label><input type="number" step="0.1" value={settings.leveling?.xpMultiplier || 1} onChange={(e) => updateSettings('leveling.xpMultiplier', parseFloat(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.maxLevel')}</label><input type="number" value={settings.leveling?.maxLevel || 100} onChange={(e) => updateSettings('leveling.maxLevel', parseInt(e.target.value))} style={inputStyle} /></div>
                </div>
                <div style={{ marginTop: '12px' }}><label style={labelStyle}>{t('tabsB.leveling.levelUpChannel')}</label>
                  <select value={settings.leveling?.levelUpChannel || ''} onChange={(e) => updateSettings('leveling.levelUpChannel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.leveling.sameChannel')}</option>
                    <option value="dm">{t('tabsB.leveling.dm')}</option>
                    <option value="disabled">{t('tabsB.leveling.disabled')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: '12px' }}><label style={labelStyle}>{t('tabsB.leveling.levelUpMessage')}</label>
                  <input type="text" value={settings.leveling?.levelUpMessage || ''} onChange={(e) => updateSettings('leveling.levelUpMessage', e.target.value)} style={inputStyle} placeholder={t('tabsB.leveling.levelUpPlaceholder')} />
                </div>
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.leveling?.voiceXp || false} onChange={() => updateSettings('leveling.voiceXp', !settings.leveling?.voiceXp)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsB.leveling.voiceXp')}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.leveling?.stackRoles || false} onChange={() => updateSettings('leveling.stackRoles', !settings.leveling?.stackRoles)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsB.leveling.stackRoles')}</span>
                  </label>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.leveling.roleRewards')}</h3>
                {(settings.leveling?.roleRewards || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <span style={{ width: '70px', color: '#948C7C', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{t('tabsB.leveling.levelCol')}</span>
                    <span style={{ flex: 1, color: '#948C7C', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{t('tabsB.common.role')}</span>
                    <span style={{ width: '32px' }}></span>
                  </div>
                )}
                {(settings.leveling?.roleRewards || []).map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="number" value={r.level} onChange={(e) => { const rw = [...(settings.leveling?.roleRewards || [])]; rw[i].level = parseInt(e.target.value); updateSettings('leveling.roleRewards', rw); }} style={{ ...inputStyle, width: '70px' }} placeholder={t('tabsB.leveling.lvlPlaceholder')} />
                    <select value={r.roleId} onChange={(e) => { const rw = [...(settings.leveling?.roleRewards || [])]; rw[i].roleId = e.target.value; updateSettings('leveling.roleRewards', rw); }} style={{ ...inputStyle, flex: 1 }}>
                      <option value="">{t('tabsB.common.role')}</option>
                      {roles.map(ro => <option key={ro.id} value={ro.id}>{ro.name}</option>)}
                    </select>
                    <button onClick={() => updateSettings('leveling.roleRewards', (settings.leveling?.roleRewards || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                  </div>
                ))}
                <button onClick={() => updateSettings('leveling.roleRewards', [...(settings.leveling?.roleRewards || []), { level: 5, roleId: '' }])} style={btnSecondary}>{t('tabsB.common.add')}</button>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.leveling.xpExceptions')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.leveling.noXpRole')}</label>
                    <MultiSelect items={roles} value={settings.leveling?.noXpRoles || []} onChange={(v) => updateSettings('leveling.noXpRoles', v)} placeholder={t('tabsB.common.searchRole')} emptyLabel={t('tabsB.leveling.noXpRoleEmpty')} prefix="@" maxHeight={140} />
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.leveling.noXpChannels')}</label>
                    <MultiSelect items={textChannels} value={settings.leveling?.noXpChannels || []} onChange={(v) => updateSettings('leveling.noXpChannels', v)} placeholder={t('tabsB.common.searchChannel')} emptyLabel={t('tabsB.leveling.noXpChannelsEmpty')} prefix="#" maxHeight={140} />
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
