/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  PermissionFlagsBits
} from 'discord.js';
import { getDatabase } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { getDangerousRolePermissions } from '../../utils/helpers.js';

function emojiMatches(stored: string, reaction: MessageReaction | PartialMessageReaction): boolean {
  const s = (stored || '').trim();
  if (!s || s === 'select_menu' || s === 'button') return false;

  const custom = s.match(/^<a?:[\w~]+:(\d+)>$/);
  if (custom) return reaction.emoji.id === custom[1];
  if (/^\d+$/.test(s)) return reaction.emoji.id === s;
  return reaction.emoji.name === s;
}

export default function registerReactionRoles(client: Client): void {
  const handle = async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    adding: boolean
  ) => {
    try {
      if (user.bot) return;

      if (reaction.partial) reaction = await reaction.fetch();
      const guild = reaction.message.guild;
      if (!guild) return;

      const db = getDatabase();
      const rows = await db.find('reaction_roles_config', {
        guild_id: guild.id,
        message_id: reaction.message.id
      });
      if (!rows || rows.length === 0) return;

      const row = rows.find((r: any) => emojiMatches(r.emoji, reaction));
      if (!row || !row.role_id || row.role_id === 'placeholder') return;

      const me = guild.members.me;
      const role = guild.roles.cache.get(row.role_id);
      if (!role || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) return;
      if (role.position >= me.roles.highest.position) {
        logger.warn(`[reactionRoles] Cannot manage role ${role.name} (${role.id}) - bot role is not above it.`);
        return;
      }
      if (getDangerousRolePermissions(role.permissions).length > 0) {
        logger.warn(`[reactionRoles] Refusing to grant ${role.name} (${role.id}) - role has sensitive permissions.`);
        return;
      }

      const member = await guild.members.fetch(user.id);
      if (adding) {
        if (!member.roles.cache.has(role.id)) await member.roles.add(role.id);
      } else {
        if (member.roles.cache.has(role.id)) await member.roles.remove(role.id);
      }
    } catch (error) {
      logger.error('Reaction roles error:', error as Error);
    }
  };

  client.on('messageReactionAdd', (reaction, user) => void handle(reaction, user, true));
  client.on('messageReactionRemove', (reaction, user) => void handle(reaction, user, false));
}
