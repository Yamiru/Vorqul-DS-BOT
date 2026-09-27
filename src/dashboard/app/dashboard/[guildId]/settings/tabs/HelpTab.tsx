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

// `desc` and `titleKey` hold translation keys, resolved with t() at render time.
const COMMAND_GROUPS: Array<{
  titleKey: string;
  commands: Array<{ cmd: string; desc: string; sub?: string }>;
}> = [
  {
    titleKey: 'tabsB.help.group.moderation',
    commands: [
      { cmd: '/altcheck', desc: 'tabsB.help.cmd.altcheck' },
      { cmd: '/appeal', desc: 'tabsB.help.cmd.appeal' },
      { cmd: '/ban', desc: 'tabsB.help.cmd.ban' },
      { cmd: '/case', desc: 'tabsB.help.cmd.case' },
      { cmd: '/cleanup', desc: 'tabsB.help.cmd.cleanup' },
      { cmd: '/clear', desc: 'tabsB.help.cmd.clear' },
      { cmd: '/jail', desc: 'tabsB.help.cmd.jail' },
      { cmd: '/kick', desc: 'tabsB.help.cmd.kick' },
      { cmd: '/lock', desc: 'tabsB.help.cmd.lock' },
      { cmd: '/lockdown', desc: 'tabsB.help.cmd.lockdown' },
      { cmd: '/massnick', desc: 'tabsB.help.cmd.massnick' },
      { cmd: '/massrole', desc: 'tabsB.help.cmd.massrole' },
      { cmd: '/mute', desc: 'tabsB.help.cmd.mute' },
      { cmd: '/nick', desc: 'tabsB.help.cmd.nick' },
      { cmd: '/note', desc: 'tabsB.help.cmd.note' },
      { cmd: '/notes', desc: 'tabsB.help.cmd.notes' },
      { cmd: '/permcheck', desc: 'tabsB.help.cmd.permcheck' },
      { cmd: '/role', desc: 'tabsB.help.cmd.role' },
      { cmd: '/shadowmute', desc: 'tabsB.help.cmd.shadowmute' },
      { cmd: '/slowmode', desc: 'tabsB.help.cmd.slowmode' },
      { cmd: '/softban', desc: 'tabsB.help.cmd.softban' },
      { cmd: '/tempban', desc: 'help.tempban' },
      { cmd: '/timedrole', desc: 'help.timedrole' },
      { cmd: '/timeout', desc: 'tabsB.help.cmd.timeout' },
      { cmd: '/unban', desc: 'tabsB.help.cmd.unban' },
      { cmd: '/unjail', desc: 'tabsB.help.cmd.unjail' },
      { cmd: '/unlock', desc: 'tabsB.help.cmd.unlock' },
      { cmd: '/unmute', desc: 'tabsB.help.cmd.unmute' },
      { cmd: '/unshadowmute', desc: 'tabsB.help.cmd.unshadowmute' },
      { cmd: '/untimeout', desc: 'tabsB.help.cmd.untimeout' },
      { cmd: '/voicemute', desc: 'help.voicemute' },
      { cmd: '/warn', desc: 'tabsB.help.cmd.warn' },
    ],
  },
  {
    titleKey: 'tabsB.help.group.administration',
    commands: [
      { cmd: '/antinuke', desc: 'help.antinuke' },
      { cmd: '/channels', desc: 'help.channels' },
      { cmd: '/persist', desc: 'tabsB.help.cmd.persist' },
      { cmd: '/premium', desc: 'tabsB.help.cmd.premium' },
      { cmd: '/texts', desc: 'help.texts' },
    ],
  },
  {
    titleKey: 'tabsB.help.group.utility',
    commands: [
      { cmd: '/afk', desc: 'tabsB.help.cmd.afk' },
      { cmd: '/apply', desc: 'tabsB.help.cmd.apply' },
      { cmd: '/autoresponse', desc: 'tabsB.help.cmd.autoresponse' },
      { cmd: '/birthday', desc: 'tabsB.help.cmd.birthday' },
      { cmd: '/coinflip', desc: 'tabsB.help.cmd.coinflip' },
      { cmd: '/confess', desc: 'tabsB.help.cmd.confess' },
      { cmd: '/connect4', desc: 'tabsB.help.cmd.connect4' },
      { cmd: '/digest', desc: 'tabsB.help.cmd.digest' },
      { cmd: '/feed', desc: 'tabsB.help.cmd.feed' },
      { cmd: '/filter', desc: 'tabsB.help.cmd.filter' },
      { cmd: '/gamestats', desc: 'tabsB.help.cmd.gamestats' },
      { cmd: '/help', desc: 'tabsB.help.cmd.help' },
      { cmd: '/invites', desc: 'tabsB.help.cmd.invites' },
      { cmd: '/leaderboard', desc: 'tabsB.help.cmd.leaderboard' },
      { cmd: '/levelroles', desc: 'tabsB.help.cmd.levelroles' },
      { cmd: '/logs', desc: 'tabsB.help.cmd.logs' },
      { cmd: '/msgtop', desc: 'tabsB.help.cmd.msgtop' },
      { cmd: '/rank', desc: 'tabsB.help.cmd.rank' },
      { cmd: '/reactionroles', desc: 'tabsB.help.cmd.reactionroles' },
      { cmd: '/referral', desc: 'tabsB.help.cmd.referral' },
      { cmd: '/rep', desc: 'tabsB.help.cmd.rep' },
      { cmd: '/rolemenu', desc: 'tabsB.help.cmd.rolemenu' },
      { cmd: '/rps', desc: 'tabsB.help.cmd.rps' },
      { cmd: '/settings', desc: 'tabsB.help.cmd.settings' },
      { cmd: '/streak', desc: 'tabsB.help.cmd.streak' },
      { cmd: '/suggest', desc: 'tabsB.help.cmd.suggest' },
      { cmd: '/tempchannel', desc: 'tabsB.help.cmd.tempchannel' },
      { cmd: '/ticket', desc: 'tabsB.help.cmd.ticket' },
      { cmd: '/tictactoe', desc: 'tabsB.help.cmd.tictactoe' },
      { cmd: '/vctop', desc: 'tabsB.help.cmd.vctop' },
      { cmd: '/verify', desc: 'tabsB.help.cmd.verify' },
      { cmd: '/whatdidimiss', desc: 'tabsB.help.cmd.whatdidimiss' },
      { cmd: '/whywasibanned', desc: 'tabsB.help.cmd.whywasibanned' },
    ],
  },
  {
    titleKey: 'tabsB.help.group.fun',
    commands: [
      { cmd: '/8ball', desc: 'tabsB.help.cmd.8ball' },
      { cmd: '/dice', desc: 'tabsB.help.cmd.dice' },
      { cmd: '/giveaway', desc: 'tabsB.help.cmd.giveaway' },
      { cmd: '/matchmaking', desc: 'tabsB.help.cmd.matchmaking' },
      { cmd: '/poll', desc: 'tabsB.help.cmd.poll' },
      { cmd: '/quest', desc: 'tabsB.help.cmd.quest' },
      { cmd: '/trivia', desc: 'tabsB.help.cmd.trivia' },
    ],
  },
];

export default function HelpTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle } = ctx;

  const total = COMMAND_GROUPS.reduce((sum, group) => sum + group.commands.length, 0);

  return (
    <>
      <div style={cardStyle}>
        <h3 style={{ color: 'white', marginBottom: '8px', fontWeight: '600' }}>{t('tabsB.help.title')}</h3>
        <p style={{ color: '#948C7C', fontSize: '13px' }}>
          {t('tabsB.help.intro', { total })}
        </p>
      </div>

      {COMMAND_GROUPS.map(group => (
        <div key={group.titleKey} style={cardStyle}>
          <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t(group.titleKey)}</h3>
          <div style={{ display: 'grid', gap: '6px' }}>
            {group.commands.map(entry => (
              <div
                key={entry.cmd}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr',
                  gap: '10px',
                  padding: '8px 10px',
                  backgroundColor: '#1B1815',
                  borderRadius: '6px',
                  alignItems: 'baseline',
                }}
              >
                <code style={{ color: '#E3C766', fontSize: '13px' }}>{entry.cmd}</code>
                <div>
                  <div style={{ color: '#EDE6D8', fontSize: '13px' }}>{t(entry.desc)}</div>
                  {entry.sub && (
                    <div style={{ color: '#948C7C', fontSize: '11px', marginTop: '2px' }}>
                      {entry.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
