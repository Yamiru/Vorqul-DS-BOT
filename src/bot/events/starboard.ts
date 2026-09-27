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
} from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { handleStarboardReaction } from '../modules/starboardCore.js';
import { logger } from '../../utils/logger.js';

export default function starboardHandler(client: Client) {
  const onReaction = async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) => {
    try {
      if (!reaction.message.guild) return;
      const settings = await GuildSettings.findOne({ guildId: reaction.message.guild.id });
      if (!settings) return;
      await handleStarboardReaction(settings, reaction, user);
    } catch (error) {
      logger.error('Starboard error:', error as Error);
    }
  };

  client.on('messageReactionAdd', onReaction);
  client.on('messageReactionRemove', onReaction);
}
