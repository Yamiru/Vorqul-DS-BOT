/*!
 * Vorqul DS BOT - Channel Guard
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import type { ChannelContext } from '../../utils/channelScope.js';
import {
  isAllowedInChannel,
  isCommandAllowedInChannel,
} from '../../utils/channelScope.js';

export function channelContext(channel: any): ChannelContext {
  if (!channel || !channel.id) return { channelId: '', parentIds: [] };

  const parentIds: string[] = [];
  let cursor: any = channel;
  let depth = 0;

  while (cursor && depth < 4) {
    const parentId: string | null | undefined = cursor.parentId ?? cursor.parent_id;
    if (!parentId) break;
    if (!parentIds.includes(parentId)) parentIds.push(parentId);
    cursor = cursor.parent ?? null;
    depth++;
  }

  return { channelId: channel.id, parentIds };
}

export function featureAllowed(settings: any, feature: string, channel: any): boolean {
  return isAllowedInChannel(settings, feature, channelContext(channel));
}

export function commandAllowed(
  settings: any,
  commandName: string,
  category: string | undefined,
  channel: any
): boolean {
  return isCommandAllowedInChannel(settings, commandName, category, channelContext(channel));
}
