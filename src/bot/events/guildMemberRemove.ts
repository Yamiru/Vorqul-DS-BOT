/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, GuildMember, EmbedBuilder, TextChannel, PartialGuildMember } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { buildConfiguredMessage } from '../../utils/messageRender.js';
import { logger } from '../../utils/logger.js';

export default function guildMemberRemove(client: Client) {
  client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      const modules = settings?.modules || {};

      const goodbyeChannelId = (settings as any)?.goodbyeChannel || modules.goodbye?.channel;
      const goodbyeOn = (settings as any)?.goodbyeChannel ? true : modules.goodbye?.enabled === true;
      if (goodbyeChannelId && goodbyeOn) {
        const channel = member.guild.channels.cache.get(goodbyeChannelId) as TextChannel;
        if (channel) {
          const rawMsg = (settings as any)?.goodbyeMessage || modules.goodbye?.message || '{user} left the server.';
          const vars = {
            user: member.user?.username || 'Someone',
            username: member.user?.username || 'Someone',
            server: member.guild.name,
            count: member.guild.memberCount.toString(),
            memberCount: member.guild.memberCount.toString(),
            avatar: member.user?.displayAvatarURL() || '',
          };
          const message = String(rawMsg)
            .replace(/\{user\}/g, vars.user)
            .replace(/\{username\}/g, vars.username)
            .replace(/\{server\}/g, vars.server)
            .replace(/\{count\}/g, vars.count)
            .replace(/\{memberCount\}/g, vars.memberCount);

          const goodbyeEmbedCfg: any = (settings as any)?.goodbyeEmbed || {};
          const goodbyeIsEmbed = goodbyeEmbedCfg.enabled === true || modules.goodbye?.embedEnabled === true;

          const rendered = buildConfiguredMessage(
            goodbyeIsEmbed ? 'embed' : 'plain',
            { ...goodbyeEmbedCfg, message },
            vars,
            { plainText: message, title: '👋 Goodbye!', description: message, color: 0xff6b6b, thumbnail: member.user?.displayAvatarURL() || undefined }
          );

          const opts: any = {};
          if (rendered.content) opts.content = rendered.content;
          if (rendered.embeds) opts.embeds = rendered.embeds;
          if (!opts.content && !opts.embeds) opts.content = message;
          await channel.send(opts);
        }
      }

      if (modules.logs?.enabled && modules.logs.channels?.members) {
        const logChannel = member.guild.channels.cache.get(modules.logs.channels.members);
        if (logChannel?.isTextBased() && modules.logs.events?.memberLeave !== false) {
          const roles = member.roles?.cache
            .filter(r => r.id !== member.guild.id)
            .map(r => `<@&${r.id}>`)
            .join(', ') || 'None';

          const embed = new EmbedBuilder()
            .setTitle('📤 Member left')
            .setThumbnail(member.user?.displayAvatarURL() || null)
            .addFields(
              { name: 'User', value: `${member.user?.tag || 'Unknown'} (<@${member.id}>)`, inline: true },
              { name: 'ID', value: member.id, inline: true },
              { name: 'On server since', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
              { name: 'Role', value: roles.substring(0, 1000) }
            )
            .setColor(0xFF0000)
            .setTimestamp();

          await (logChannel as any).send({ embeds: [embed] });
        }
      }
    } catch (error) {
      logger.error('Guild member remove error:', error);
    }
  });
}
