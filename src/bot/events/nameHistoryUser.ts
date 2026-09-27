/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, User, PartialUser } from 'discord.js';
import { NameHistory } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.UserUpdate> = {
  name: Events.UserUpdate,
  execute: async (_client: Client, oldUser: User | PartialUser, newUser: User) => {
    try {
      if (newUser.bot) return;

      if (oldUser.partial) {
        try { oldUser = await oldUser.fetch(); } catch { return; }
      }

      if (oldUser.username !== newUser.username) {
        await NameHistory.add({ userId: newUser.id, type: 'username', value: newUser.username });
      }

      const oldGlobal = (oldUser as User).globalName ?? null;
      const newGlobal = newUser.globalName ?? null;
      if (oldGlobal !== newGlobal) {
        await NameHistory.add({ userId: newUser.id, type: 'globalName', value: newGlobal });
      }
    } catch (error) {
      logger.error('Error in nameHistoryUser event:', error as Error);
    }
  }
};

export default event;
