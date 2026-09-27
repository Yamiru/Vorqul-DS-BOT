/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, GuildMember, PartialGuildMember } from 'discord.js';
import { PersistedRoles, FeatureToggle } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,
  execute: async (_client: Client, member: GuildMember | PartialGuildMember) => {
    try {
      if (member.user?.bot) return;

      const enabled = await FeatureToggle.isEnabled(member.guild.id, 'rolePersist');
      if (!enabled) return;

      if (member.partial || !member.roles?.cache) return;

      const roleIds = member.roles.cache
        .filter(r => r.id !== member.guild.id && !r.managed)
        .map(r => r.id);

      await PersistedRoles.save({
        guildId: member.guild.id,
        userId: member.id,
        roles: roleIds,
        nickname: member.nickname ?? null
      });
    } catch (error) {
      logger.error('Error in rolePersistRemove event:', error as Error);
    }
  }
};

export default event;
