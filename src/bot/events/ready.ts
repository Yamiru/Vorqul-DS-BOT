/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, ActivityType, Events } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { GuildSettings } from '../../utils/models.js';
import { startStatusReporter } from '../modules/statusReporter.js';
import { startTempActionScheduler } from '../modules/tempActionScheduler.js';
import { startIdentitySync } from '../modules/botIdentity.js';
import { initBirthdayScheduler } from '../modules/birthdayScheduler.js';
import { initStatsTracker } from '../modules/statsTracker.js';
import { initPollScheduler } from '../modules/pollScheduler.js';
import { initRoleSnapshot } from '../modules/roleSnapshot.js';
import { initTaskScheduler } from '../modules/taskScheduler.js';
import { initReminderScheduler } from '../modules/reminderScheduler.js';
import { reconcileAntiRaidLockdowns } from './antiRaid.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute: async (client: Client) => {
    if (!client.user) return;

    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guilds`);
    logger.info(`Total members: ${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)}`);

    try {
      i18n.setDbLoader(async (guildId: string) => {
        const settings = await GuildSettings.findOne({ guildId });
        return settings?.language || null;
      });

      await i18n.preloadGuildLanguages(async () => {
        const allSettings = await GuildSettings.find({});
        return allSettings
          .filter(s => s.language)
          .map(s => ({ guildId: s.guildId, language: s.language }));
      });
    } catch (err) {
      logger.error('Failed to preload guild languages:', err as Error);
    }

    client.user.setPresence({
      activities: [{
        name: `/help | ${client.guilds.cache.size} servers`,
        type: ActivityType.Watching
      }],
      status: 'online'
    });

    try {
      startStatusReporter(client);
    } catch (err) {
      logger.error('Failed to start status reporter:', err as Error);
    }

    try {
      startTempActionScheduler(client);
    } catch (err) {
      logger.error('Failed to start temp action scheduler:', err as Error);
    }

    try {
      startIdentitySync(client);
    } catch (err) {
      logger.error('Failed to start identity sync:', err as Error);
    }

    try {
      initBirthdayScheduler(client);
    } catch (err) {
      logger.error('Failed to initialize birthday scheduler:', err as Error);
    }

    try {
      initStatsTracker();
    } catch (err) {
      logger.error('Failed to initialize stats tracker:', err as Error);
    }

    try {
      initPollScheduler(client);
    } catch (err) {
      logger.error('Failed to initialize poll scheduler:', err as Error);
    }

    try {
      initRoleSnapshot(client);
    } catch (err) {
      logger.error('Failed to initialize role snapshot:', err as Error);
    }

    try {
      initTaskScheduler(client);
    } catch (err) {
      logger.error('Failed to initialize task scheduler:', err as Error);
    }

    try {
      initReminderScheduler(client);
    } catch (err) {
      logger.error('Failed to initialize reminder scheduler:', err as Error);
    }

    try {
      await reconcileAntiRaidLockdowns(client);
    } catch (err) {
      logger.error('Failed to reconcile anti-raid lockdowns:', err as Error);
    }

    try {
      const { SocialFeedManager } = await import('../modules/socialFeedManager.js');
      const socialMgr = new SocialFeedManager(client);
      socialMgr.start();
    } catch (err) {
      logger.error('Failed to initialize social feeds:', err as Error);
    }

    const presenceTimer = setInterval(() => {
      if (!client.user) return;

      const activities = [
        { name: `/help | ${client.guilds.cache.size} servers`, type: ActivityType.Watching },
        { name: `${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)} users`, type: ActivityType.Watching },
        { name: 'Vorqul DS BOT by Yamiru', type: ActivityType.Playing }
      ];

      const random = activities[Math.floor(Math.random() * activities.length)];
      client.user.setActivity(random.name, { type: random.type });
    }, 60000);
    presenceTimer.unref?.();
  }
};

export default event;
