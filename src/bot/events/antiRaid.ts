/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { reportError } from '../../utils/errorReporter.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

const LOCKDOWN_DURATION_MS = 5 * 60 * 1000;

const joinTracker = new Map<string, { timestamps: number[], lockdown: boolean }>();
const JOIN_MAX_AGE_MS = 10 * 60 * 1000;

async function persistLockdownUntil(guildId: string, until: number | null): Promise<void> {
  try {
    const settings = await GuildSettings.findOne({ guildId });
    const antiRaid = { ...(settings?.modules?.antiRaid || {}), lockdownUntil: until };
    await GuildSettings.findOneAndUpdate(
      { guildId },
      { $set: { modules: { ...(settings?.modules || {}), antiRaid } } },
      { upsert: true }
    );
  } catch (error) {
    reportError('antiRaid:persistLockdown', error, { guildId });
  }
}

async function liftLockdown(client: Client, guildId: string, notify: boolean): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    await guild.roles.everyone.setPermissions(
      guild.roles.everyone.permissions.add('SendMessages')
    );
    await persistLockdownUntil(guildId, null);

    const tracker = joinTracker.get(guildId);
    if (tracker) tracker.lockdown = false;

    if (notify) {
      const settings = await GuildSettings.findOne({ guildId }).catch(() => null);
      const notifyChannelId = settings?.modules?.antiRaid?.notifyChannel;
      const notifyChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) as TextChannel : null;
      if (notifyChannel) {
        await notifyChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔓 Lockdown ended')
              .setDescription('The server has been automatically unlocked.')
              .setColor(0x00FF00)
          ]
        }).catch(suppress('antiRaid'));
      }
    }
  } catch (error) {
    reportError('antiRaid:unlock', error, { guildId });
  }
}

export async function reconcileAntiRaidLockdowns(client: Client): Promise<void> {
  try {
    const allSettings = await GuildSettings.find({});
    const now = Date.now();

    for (const settings of allSettings) {
      const guildId = settings.guildId || settings.guild_id;
      const until = settings?.modules?.antiRaid?.lockdownUntil;
      if (!guildId || !until) continue;

      if (until <= now) {
        await liftLockdown(client, guildId, true);
      } else {
        setTimeout(() => { void liftLockdown(client, guildId, true); }, until - now);
      }
    }
  } catch (error) {
    reportError('antiRaid:reconcileLockdowns', error);
  }
}

const joinSweeper = setInterval(() => {
  const cutoff = Date.now() - JOIN_MAX_AGE_MS;
  for (const [guildId, entry] of joinTracker) {
    entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
    if (entry.timestamps.length === 0 && !entry.lockdown) joinTracker.delete(guildId);
  }
}, 5 * 60 * 1000);
joinSweeper.unref?.();

export default function antiRaidHandler(client: Client) {
  client.on('guildMemberAdd', async (member: GuildMember) => {
    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      const antiRaid = settings?.modules?.antiRaid;

      if (!antiRaid?.enabled) return;

      const guildId = member.guild.id;
      const now = Date.now();

      const minAgeDays = Number(antiRaid.minAccountAgeDays || 0);
      if (minAgeDays > 0 && !member.user.bot) {
        const accountAgeMs = now - member.user.createdTimestamp;
        const requiredMs = minAgeDays * 24 * 60 * 60 * 1000;

        if (accountAgeMs < requiredMs) {
          const ageAction = antiRaid.accountAgeAction || 'kick';
          const ageDays = Math.floor(accountAgeMs / (24 * 60 * 60 * 1000));
          const ageHours = Math.floor(accountAgeMs / (60 * 60 * 1000));
          const ageLabel = ageDays >= 1 ? `${ageDays} dní` : `${ageHours} hodín`;
          const reason = `Anti-Raid: konto staré ${ageLabel}, vyžaduje sa ${minAgeDays} dní`;

          if (antiRaid.dmOnReject !== false && ageAction !== 'log') {
            const template = antiRaid.rejectMessage
              || 'Na server **{server}** sa zatiaľ nedostaneš - tvoj účet musí mať aspoň {days} dní. Skús to neskôr.';
            await member.send(
              template
                .replace(/\{server\}/g, member.guild.name)
                .replace(/\{days\}/g, String(minAgeDays))
                .replace(/\{user\}/g, member.user.username)
            ).catch(suppress('antiRaid'));
          }

          try {
            if (ageAction === 'ban') {
              await member.ban({ reason });
            } else if (ageAction === 'kick') {
              await member.kick(reason);
            } else if (ageAction === 'timeout') {
              const minutes = Number(antiRaid.accountAgeTimeoutMinutes || 60);
              await member.timeout(minutes * 60 * 1000, reason).catch(suppress('antiRaid'));
            } else if (ageAction === 'role' && antiRaid.accountAgeRole) {
              await member.roles.add(antiRaid.accountAgeRole, reason).catch(suppress('antiRaid'));
            }
          } catch (error) {
              logger.debug('antiRaid: suppressed error', error);
            }

          const ageChannel = antiRaid.notifyChannel
            ? member.guild.channels.cache.get(antiRaid.notifyChannel) as TextChannel
            : null;

          if (ageChannel && typeof ageChannel.send === 'function') {
            await ageChannel.send({
              embeds: [new EmbedBuilder()
                .setTitle('🕒 Zamietnuté nové konto')
                .setDescription(
                  `${member.user.tag} (\`${member.id}\`) sa pokúsil pripojiť.\n` +
                  `Vek konta: **${ageLabel}**, vyžaduje sa **${minAgeDays} dní**.`
                )
                .addFields(
                  { name: 'Opatrenie', value: ageAction, inline: true },
                  { name: 'Konto vytvorené', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor(0xFAA61A)
                .setTimestamp()]
            }).catch(suppress('antiRaid'));
          }

          if (ageAction === 'kick' || ageAction === 'ban') return;
        }
      }

      if (!joinTracker.has(guildId)) {
        joinTracker.set(guildId, { timestamps: [], lockdown: false });
      }

      const tracker = joinTracker.get(guildId)!;

      tracker.timestamps.push(now);

      const interval = (antiRaid.joinInterval || 10) * 1000;
      tracker.timestamps = tracker.timestamps.filter(t => now - t < interval);

      const threshold = antiRaid.joinThreshold || 10;

      if (tracker.timestamps.length >= threshold && !tracker.lockdown) {
        tracker.lockdown = true;

        const action = antiRaid.action || 'kick';
        const notifyChannel = antiRaid.notifyChannel
          ? member.guild.channels.cache.get(antiRaid.notifyChannel) as TextChannel
          : null;

        if (notifyChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🚨 RAID DETECTED!')
            .setDescription(`Detected **${tracker.timestamps.length}** joins in **${antiRaid.joinInterval}** seconds!`)
            .addFields(
              { name: 'Akcia', value: action.toUpperCase(), inline: true },
              { name: 'Time', value: `<t:${Math.floor(now / 1000)}:F>`, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

          await notifyChannel.send({
            content: '@everyone',
            embeds: [embed]
          });
        }

        if (action === 'lockdown') {
          try {
            await member.guild.roles.everyone.setPermissions(
              member.guild.roles.everyone.permissions.remove('SendMessages')
            );

            const until = now + LOCKDOWN_DURATION_MS;
            await persistLockdownUntil(member.guild.id, until);

            setTimeout(() => { void liftLockdown(client, member.guild.id, true); }, LOCKDOWN_DURATION_MS);
          } catch (error) {
            reportError('antiRaid:lockdown', error, { guildId: member.guild.id });
          }
        }

        if (action === 'kick' || action === 'ban') {
          const recentMembers = member.guild.members.cache.filter(m => {
            const joinedAt = m.joinedTimestamp;
            return joinedAt && now - joinedAt < interval;
          });

          for (const [, raidMember] of recentMembers) {
            try {
              if (action === 'kick') {
                await raidMember.kick('Anti-Raid: Suspicious join');
              } else {
                await raidMember.ban({ reason: 'Anti-Raid: Suspicious join', deleteMessageSeconds: 60 });
              }
            } catch (error) {
              reportError('antiRaid:punish', error, { guildId: member.guild.id, userId: raidMember.id, action });
            }
          }

          setTimeout(() => {
            tracker.lockdown = false;
          }, 30000);
        }
      }
    } catch (error) {
      logger.error('Anti-raid error:', error);
    }
  });
}
