'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function SuggestionsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.suggestions.title')}</h3>
                <input type="checkbox" checked={settings.suggestions?.enabled || false} onChange={() => updateSettings('suggestions.enabled', !settings.suggestions?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsB.suggestions.channel')}</label>
                  <select value={settings.suggestions?.channel || ''} onChange={(e) => updateSettings('suggestions.channel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.common.select')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.suggestions.upvote')}</label><input type="text" value={settings.suggestions?.upvoteEmoji || '👍'} onChange={(e) => updateSettings('suggestions.upvoteEmoji', e.target.value)} style={{ ...inputStyle, width: '60px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsB.suggestions.downvote')}</label><input type="text" value={settings.suggestions?.downvoteEmoji || '👎'} onChange={(e) => updateSettings('suggestions.downvoteEmoji', e.target.value)} style={{ ...inputStyle, width: '60px' }} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.suggestions?.autoThread || false} onChange={() => updateSettings('suggestions.autoThread', !settings.suggestions?.autoThread)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.suggestions.autoThread')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.suggestions?.anonymousAllowed || false} onChange={() => updateSettings('suggestions.anonymousAllowed', !settings.suggestions?.anonymousAllowed)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.suggestions.anonymous')}</span>
                </label>
              </div>
            </div>
    </>
  );
}
