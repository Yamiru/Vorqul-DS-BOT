'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useState } from 'react';
import { useT } from '../../../../components/LanguageProvider';
import { GAMES, type GameDefinition } from '../../../../../lib/gameRegistry';
import type { SettingsTabProps } from './types';

export default function GamesTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, setActiveTab, settings, textChannels, updateSettings } = ctx;
  const [openGame, setOpenGame] = useState<string | null>(null);

  const games = settings.games || {};
  const isEnabled = (game: GameDefinition): boolean => {
    const value = games[game.key]?.enabled;
    return typeof value === 'boolean' ? value : true;
  };
  const valueOf = (game: GameDefinition, settingKey: string) => {
    const stored = games[game.key]?.[settingKey];
    const definition = game.settings.find((s) => s.key === settingKey);
    return stored !== undefined && stored !== null ? stored : definition?.default;
  };
  const enabledCount = GAMES.filter(isEnabled).length;

  return (
    <>
      <div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <h3 style={{ color: 'white', fontWeight: '600' }}>{t('games.title')}</h3>
            <span style={{ color: '#948C7C', fontSize: '12px' }}>{t('games.enabledOf', { a: enabledCount, b: GAMES.length })}</span>
          </div>
          <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '12px' }}>{t('games.subtitle')}</p>
          <div style={{ padding: '10px', backgroundColor: '#1B1815', borderRadius: '6px', marginBottom: '14px' }}>
            <p style={{ color: '#948C7C', fontSize: '12px', margin: 0 }}>
              {t('cfg.games.noteBefore')}{' '}
              <button type="button" onClick={() => setActiveTab('channels')} style={{ color: '#14707A', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px' }}>
                {t('cfg.games.noteLink')}
              </button>
              {t('cfg.games.noteAfter')}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {GAMES.map((game) => {
              const on = isEnabled(game);
              const open = openGame === game.key;
              return (
                <div key={game.key} style={{ border: '1px solid #2C271F', borderRadius: '8px', backgroundColor: '#141517' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => updateSettings(`games.${game.key}.enabled`, !on)}
                        style={{ accentColor: '#14707A', marginTop: '2px' }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ color: '#EDE6D8', fontSize: '13px', fontWeight: 500, display: 'block' }}>
                          {game.emoji} {t(game.label)}
                          <code style={{ marginLeft: '6px', fontSize: '11px', color: '#948C7C' }}>/{game.command}</code>
                          {game.multiplayer && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#2C271F', color: '#948C7C', padding: '1px 6px', borderRadius: '4px' }}>
                              {t('games.multiplayer')}
                            </span>
                          )}
                        </span>
                        <span style={{ color: '#948C7C', fontSize: '11px', display: 'block' }}>{t(game.description)}</span>
                      </span>
                    </label>
                    {game.settings.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenGame(open ? null : game.key)}
                        disabled={!on}
                        style={{ color: '#14707A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}
                      >
                        {open ? t('games.hideCfg') : t('games.configure')}
                      </button>
                    )}
                  </div>

                  {open && on && game.settings.length > 0 && (
                    <div style={{ borderTop: '1px solid #2C271F', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                      {game.settings.map((setting) => (
                        <div key={setting.key}>
                          <label style={labelStyle}>{t(setting.label)}</label>
                          {setting.type === 'boolean' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EDE6D8', fontSize: '13px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(valueOf(game, setting.key))}
                                onChange={(e) => updateSettings(`games.${game.key}.${setting.key}`, e.target.checked)}
                                style={{ accentColor: '#14707A' }}
                              />
                              {valueOf(game, setting.key) ? t('common.enabled') : t('common.disabled')}
                            </label>
                          ) : (
                            <input
                              type="number"
                              min={setting.min}
                              max={setting.max}
                              value={Number(valueOf(game, setting.key))}
                              onChange={(e) => updateSettings(`games.${game.key}.${setting.key}`, Number(e.target.value))}
                              style={inputStyle}
                            />
                          )}
                          {setting.hint && <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '4px' }}>{t(setting.hint)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.counting.title')}</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.modules?.counting?.enabled || false} onChange={() => updateSettings('modules.counting.enabled', !settings.modules?.counting?.enabled)} style={{ accentColor: '#14707A' }} />
            <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.enable')}</span>
          </label>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div><label style={labelStyle}>{t('tabsA.counting.channel')}</label>
              <select value={settings.modules?.counting?.channel || ''} onChange={(e) => updateSettings('modules.counting.channel', e.target.value)} style={inputStyle}>
                <option value="">{t('tabsA.common.select')}</option>
                {textChannels.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.modules?.counting?.allowSameUser || false} onChange={() => updateSettings('modules.counting.allowSameUser', !settings.modules?.counting?.allowSameUser)} style={{ accentColor: '#14707A' }} />
              <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.allowSameUser')}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.modules?.counting?.deleteWrong || false} onChange={() => updateSettings('modules.counting.deleteWrong', !settings.modules?.counting?.deleteWrong)} style={{ accentColor: '#14707A' }} />
              <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.deleteWrong')}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div><label style={labelStyle}>{t('tabsA.counting.goal')}</label>
                <input type="number" min={0} value={settings.modules?.counting?.goal || 0} onChange={(e) => updateSettings('modules.counting.goal', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div><label style={labelStyle}>{t('tabsA.counting.goalRole')}</label>
                <select value={settings.modules?.counting?.goalRole || ''} onChange={(e) => updateSettings('modules.counting.goalRole', e.target.value)} style={inputStyle}>
                  <option value="">{t('tabsA.common.none')}</option>
                  {roles.map((r: { id: string; name: string }) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ ...inputStyle, backgroundColor: '#1B1815', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#948C7C', fontSize: '12px' }}>{t('tabsA.counting.currentCount')}</span>
              <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsA.counting.countAndBest', { count: settings.modules?.counting?.currentCount || 0, best: settings.modules?.counting?.highScore || 0 })}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
