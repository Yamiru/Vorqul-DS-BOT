/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, GuildMember, PermissionFlagsBits } from 'discord.js';
import { PersistedRoles, FeatureToggle } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  execute: async (_client: Client, member: GuildMember) => {
    try {
      if (member.user.bot) return;

      const enabled = await FeatureToggle.isEnabled(member.guild.id, 'rolePersist');
      if (!enabled) return;

      const saved = await PersistedRoles.get(member.guild.id, member.id);
      if (!saved) return;

      const me = member.guild.members.me;
      if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return;

      const botTop = me.roles.highest.position;

      const assignable = saved.roles.filter(id => {
        const role = member.guild.roles.cache.get(id);
        return role && !role.managed && role.id !== member.guild.id && role.position < botTop;
      });

      if (assignable.length > 0) {
        await member.roles.add(assignable, 'Role persist: restored on rejoin').catch(() => null);
      }

      if (saved.nickname && me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        await member.setNickname(saved.nickname, 'Role persist: restored on rejoin').catch(() => null);
      }

      await PersistedRoles.clear(member.guild.id, member.id);
    } catch (error) {
      logger.error('Error in rolePersistAdd event:', error as Error);
    }
  }
};

export default event;
