/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client } from 'discord.js';
import { dispatchWebhook } from '../modules/webhookDispatcher.js';

export default function webhookEvents(client: Client): void {
  client.on('guildMemberAdd', (member: any) => {
    if (member.guild) dispatchWebhook(member.guild.id, 'memberJoin', {
      userId: member.id, username: member.user?.username, memberCount: member.guild.memberCount
    });
  });

  client.on('guildMemberRemove', (member: any) => {
    if (member.guild) dispatchWebhook(member.guild.id, 'memberLeave', {
      userId: member.id, username: member.user?.username, memberCount: member.guild.memberCount
    });
  });

  client.on('guildBanAdd', (ban: any) => {
    if (ban.guild) dispatchWebhook(ban.guild.id, 'memberBan', {
      userId: ban.user?.id, username: ban.user?.username
    });
  });

  client.on('guildBanRemove', (ban: any) => {
    if (ban.guild) dispatchWebhook(ban.guild.id, 'memberUnban', {
      userId: ban.user?.id, username: ban.user?.username
    });
  });
}
