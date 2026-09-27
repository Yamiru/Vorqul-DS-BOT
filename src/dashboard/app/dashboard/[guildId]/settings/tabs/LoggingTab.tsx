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

// `label` / `desc` hold translation keys, resolved with t() at render time.
const LOG_CATEGORIES = [
  { key: 'moderation', label: 'tabsB.logging.cat.moderation.label', desc: 'tabsB.logging.cat.moderation.desc' },
  { key: 'messages', label: 'tabsB.logging.cat.messages.label', desc: 'tabsB.logging.cat.messages.desc' },
  { key: 'members', label: 'tabsB.logging.cat.members.label', desc: 'tabsB.logging.cat.members.desc' },
  { key: 'server', label: 'tabsB.logging.cat.server.label', desc: 'tabsB.logging.cat.server.desc' },
  { key: 'voice', label: 'tabsB.logging.cat.voice.label', desc: 'tabsB.logging.cat.voice.desc' },
  { key: 'roles', label: 'tabsB.logging.cat.roles.label', desc: 'tabsB.logging.cat.roles.desc' },
  { key: 'channels', label: 'tabsB.logging.cat.channels.label', desc: 'tabsB.logging.cat.channels.desc' },
  { key: 'invites', label: 'tabsB.logging.cat.invites.label', desc: 'tabsB.logging.cat.invites.desc' },
  { key: 'threads', label: 'tabsB.logging.cat.threads.label', desc: 'tabsB.logging.cat.threads.desc' },
  { key: 'emojis', label: 'tabsB.logging.cat.emojis.label', desc: 'tabsB.logging.cat.emojis.desc' },
  { key: 'boosts', label: 'tabsB.logging.cat.boosts.label', desc: 'tabsB.logging.cat.boosts.desc' },
];

const LOG_EVENTS = [
  { key: 'messageEdit', label: 'tabsB.logging.ev.messageEdit' },
  { key: 'messageDelete', label: 'tabsB.logging.ev.messageDelete' },
  { key: 'messageBulkDelete', label: 'tabsB.logging.ev.messageBulkDelete' },
  { key: 'memberJoin', label: 'tabsB.logging.ev.memberJoin' },
  { key: 'memberLeave', label: 'tabsB.logging.ev.memberLeave' },
  { key: 'voiceJoin', label: 'tabsB.logging.ev.voiceJoin' },
  { key: 'voiceLeave', label: 'tabsB.logging.ev.voiceLeave' },
  { key: 'voiceMove', label: 'tabsB.logging.ev.voiceMove' },
  { key: 'roleCreate', label: 'tabsB.logging.ev.roleCreate' },
  { key: 'roleDelete', label: 'tabsB.logging.ev.roleDelete' },
  { key: 'channelCreate', label: 'tabsB.logging.ev.channelCreate' },
  { key: 'channelDelete', label: 'tabsB.logging.ev.channelDelete' },
  { key: 'threadCreate', label: 'tabsB.logging.ev.threadCreate' },
  { key: 'threadDelete', label: 'tabsB.logging.ev.threadDelete' },
];

export default function LoggingTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, textChannels, updateSettings } = ctx;

  const logs = settings.logs || {};
  const channels = logs.channels || {};
  const events = logs.events || {};

  return (
    <>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.logging.title')}</h3>
          <input
            type="checkbox"
            checked={logs.enabled || false}
            onChange={() => updateSettings('logs.enabled', !logs.enabled)}
            style={{ accentColor: '#14707A', width: '20px', height: '20px' }}
          />
        </div>
        <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>
          {t('tabsB.logging.categoryHint')}
        </p>
        <div style={{ display: 'grid', gap: '10px' }}>
          {LOG_CATEGORIES.map(log => (
            <div key={log.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center', padding: '10px', backgroundColor: '#1B1815', borderRadius: '6px' }}>
              <div>
                <div style={{ color: '#EDE6D8', fontSize: '13px' }}>{t(log.label)}</div>
                <div style={{ color: '#948C7C', fontSize: '11px' }}>{t(log.desc)}</div>
              </div>
              <select
                value={channels[log.key] || ''}
                onChange={(e) => updateSettings(`logs.channels.${log.key}`, e.target.value || '')}
                style={{ ...inputStyle, padding: '8px' }}
              >
                <option value="">{t('tabsB.logging.disabled')}</option>
                {textChannels.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.logging.events')}</h3>
        <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>
          {t('tabsB.logging.eventsHint')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
          {LOG_EVENTS.map(ev => (
            <label key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#1B1815', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={events[ev.key] !== false}
                onChange={() => updateSettings(`logs.events.${ev.key}`, events[ev.key] === false)}
                style={{ accentColor: '#14707A' }}
              />
              <span style={{ color: '#EDE6D8', fontSize: '12px' }}>{t(ev.label)}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.logging.ignoredChannels')}</h3>
        <label style={labelStyle}>{t('tabsB.logging.ignoredHint')}</label>
        <MultiSelect
          items={textChannels}
          value={logs.blacklistChannels || []}
          onChange={(v: string[]) => updateSettings('logs.blacklistChannels', v)}
          placeholder={t('tabsB.common.searchChannel')}
          emptyLabel={t('tabsB.logging.loggedEverywhere')}
          prefix="#"
          maxHeight={160}
        />
      </div>
    </>
  );
}
