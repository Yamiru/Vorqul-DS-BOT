/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, GuildMember, PartialGuildMember } from 'discord.js';
import { NameHistory } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.GuildMemberUpdate> = {
  name: Events.GuildMemberUpdate,
  execute: async (_client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    try {
      if (newMember.user.bot) return;

      const oldNick = oldMember.partial ? null : (oldMember.nickname ?? null);
      const newNick = newMember.nickname ?? null;

      if (oldNick !== newNick) {
        await NameHistory.add({
          guildId: newMember.guild.id,
          userId: newMember.id,
          type: 'nickname',
          value: newNick
        });
      }
    } catch (error) {
      logger.error('Error in nameHistoryMember event:', error as Error);
    }
  }
};

export default event;
