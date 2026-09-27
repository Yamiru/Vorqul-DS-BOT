/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Client,
  ChannelType,
  Message,
  PartialMessage,
  GuildMember,
  PartialGuildMember,
} from 'discord.js';
import { sendLog, logEmbed, LOG_COLORS } from '../modules/logDispatcher.js';
import { extractMentionTargets } from '../../utils/automodDetectors.js';
import { GuildSettings } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';

const CHANNEL_TYPE_KEYS: Record<number, string> = {
  [ChannelType.GuildText]: 'serverLogs.type.text',
  [ChannelType.GuildVoice]: 'serverLogs.type.voice',
  [ChannelType.GuildCategory]: 'serverLogs.type.category',
  [ChannelType.GuildAnnouncement]: 'serverLogs.type.announcement',
  [ChannelType.GuildForum]: 'serverLogs.type.forum',
};

function t(guild: { id: string } | null | undefined, key: string): string {
  return i18n.t(`serverLogs.${key}`, guild?.id);
}

function channelTypeName(guild: { id: string } | null | undefined, type: number): string {
  const key = CHANNEL_TYPE_KEYS[type];
  return key ? i18n.t(key, guild?.id) : 'stage';
}

export default function serverLogsHandler(client: Client) {
  client.on('threadCreate', async (thread) => {
    if (!thread.guild) return;
    await sendLog(thread.guild, 'threads', 'threadCreate',
      logEmbed(t(thread.guild, 'title.threadCreated'), LOG_COLORS.create).addFields(
        { name: t(thread.guild, 'field.thread'), value: `${thread} (\`${thread.name}\`)`, inline: true },
        { name: t(thread.guild, 'field.parentChannel'), value: thread.parentId ? `<#${thread.parentId}>` : t(thread.guild, 'value.unknownLower'), inline: true },
        { name: t(thread.guild, 'field.author'), value: thread.ownerId ? `<@${thread.ownerId}>` : t(thread.guild, 'value.unknownLower'), inline: true }
      ),
      { sourceChannelId: thread.parentId }
    );
  });

  client.on('threadDelete', async (thread) => {
    if (!thread.guild) return;
    await sendLog(thread.guild, 'threads', 'threadDelete',
      logEmbed(t(thread.guild, 'title.threadDeleted'), LOG_COLORS.delete).addFields(
        { name: t(thread.guild, 'field.name'), value: `\`${thread.name}\``, inline: true },
        { name: t(thread.guild, 'field.parentChannel'), value: thread.parentId ? `<#${thread.parentId}>` : t(thread.guild, 'value.unknownLower'), inline: true }
      ),
      { sourceChannelId: thread.parentId }
    );
  });

  client.on('threadUpdate', async (oldThread, newThread) => {
    if (!newThread.guild) return;

    const changes: string[] = [];
    if (oldThread.name !== newThread.name) changes.push(`${t(newThread.guild, 'field.name')}: \`${oldThread.name}\` \u2192 \`${newThread.name}\``);
    if (oldThread.archived !== newThread.archived) changes.push(newThread.archived ? t(newThread.guild, 'field.archived') : t(newThread.guild, 'field.unarchived'));
    if (oldThread.locked !== newThread.locked) changes.push(newThread.locked ? t(newThread.guild, 'field.locked') : t(newThread.guild, 'field.unlocked'));
    if (changes.length === 0) return;

    await sendLog(newThread.guild, 'threads', 'threadUpdate',
      logEmbed(t(newThread.guild, 'title.threadUpdated'), LOG_COLORS.update)
        .setDescription(`${newThread}\n\n${changes.join('\n')}`),
      { sourceChannelId: newThread.parentId }
    );
  });

  client.on('emojiCreate', async (emoji) => {
    if (!emoji.guild) return;
    await sendLog(emoji.guild, 'emojis', 'emojiCreate',
      logEmbed(t(emoji.guild, 'title.emojiAdded'), LOG_COLORS.create)
        .setDescription(`${emoji} \`:${emoji.name}:\``)
        .setThumbnail(emoji.imageURL())
    );
  });

  client.on('emojiDelete', async (emoji) => {
    if (!emoji.guild) return;
    await sendLog(emoji.guild, 'emojis', 'emojiDelete',
      logEmbed(t(emoji.guild, 'title.emojiRemoved'), LOG_COLORS.delete)
        .setDescription(`\`:${emoji.name}:\``)
        .setThumbnail(emoji.imageURL())
    );
  });

  client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
    if (!newEmoji.guild || oldEmoji.name === newEmoji.name) return;
    await sendLog(newEmoji.guild, 'emojis', 'emojiUpdate',
      logEmbed(t(newEmoji.guild, 'title.emojiRenamed'), LOG_COLORS.update)
        .setDescription(`\`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\``)
    );
  });

  client.on('stickerCreate', async (sticker) => {
    if (!sticker.guild) return;
    await sendLog(sticker.guild, 'emojis', 'stickerCreate',
      logEmbed(t(sticker.guild, 'title.stickerAdded'), LOG_COLORS.create).addFields(
        { name: t(sticker.guild, 'field.name'), value: `\`${sticker.name}\``, inline: true },
        { name: 'Popis', value: sticker.description || t(sticker.guild, 'value.none'), inline: true }
      )
    );
  });

  client.on('stickerDelete', async (sticker) => {
    if (!sticker.guild) return;
    await sendLog(sticker.guild, 'emojis', 'stickerDelete',
      logEmbed(t(sticker.guild, 'title.stickerRemoved'), LOG_COLORS.delete)
        .setDescription(`\`${sticker.name}\``)
    );
  });

  client.on('stickerUpdate', async (oldSticker, newSticker) => {
    if (!newSticker.guild || oldSticker.name === newSticker.name) return;
    await sendLog(newSticker.guild, 'emojis', 'stickerUpdate',
      logEmbed(t(newSticker.guild, 'title.stickerRenamed'), LOG_COLORS.update)
        .setDescription(`\`${oldSticker.name}\` → \`${newSticker.name}\``)
    );
  });

  client.on('inviteCreate', async (invite) => {
    if (!invite.guild) return;
    const expires = invite.expiresTimestamp
      ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`
      : t(invite.guild, 'value.never');

    await sendLog(invite.guild as any, 'invites', 'inviteCreate',
      logEmbed(t(invite.guild, 'title.inviteCreated'), LOG_COLORS.create).addFields(
        { name: t(invite.guild, 'field.code'), value: `\`${invite.code}\``, inline: true },
        { name: t(invite.guild, 'field.author'), value: invite.inviter ? `<@${invite.inviter.id}>` : t(invite.guild, 'value.unknownLower'), inline: true },
        { name: t(invite.guild, 'field.channel'), value: invite.channelId ? `<#${invite.channelId}>` : t(invite.guild, 'value.unknownLower'), inline: true },
        { name: t(invite.guild, 'field.useLimit'), value: invite.maxUses ? String(invite.maxUses) : t(invite.guild, 'value.noLimit'), inline: true },
        { name: t(invite.guild, 'field.expires'), value: expires, inline: true }
      ),
      { sourceChannelId: invite.channelId }
    );
  });

  client.on('inviteDelete', async (invite) => {
    if (!invite.guild) return;
    await sendLog(invite.guild as any, 'invites', 'inviteDelete',
      logEmbed(t(invite.guild, 'title.inviteDeleted'), LOG_COLORS.delete).addFields(
        { name: t(invite.guild, 'field.code'), value: `\`${invite.code}\``, inline: true },
        { name: t(invite.guild, 'field.channel'), value: invite.channelId ? `<#${invite.channelId}>` : t(invite.guild, 'value.unknownLower'), inline: true }
      ),
      { sourceChannelId: invite.channelId }
    );
  });

  client.on('guildMemberUpdate', async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ) => {
    const wasBoosting = Boolean(oldMember.premiumSince);
    const isBoosting = Boolean(newMember.premiumSince);
    if (wasBoosting === isBoosting) return;

    const tier = newMember.guild.premiumTier;
    const count = newMember.guild.premiumSubscriptionCount ?? 0;

    await sendLog(newMember.guild, 'boosts', isBoosting ? 'boostStart' : 'boostEnd',
      logEmbed(
        isBoosting ? t(newMember.guild, 'title.boostStarted') : t(newMember.guild, 'title.boostEnded'),
        isBoosting ? LOG_COLORS.boost : LOG_COLORS.delete
      )
        .setDescription(
          isBoosting
            ? i18n.t('serverLogs.boostStartedBody', newMember.guild.id, { user: String(newMember) })
            : i18n.t('serverLogs.boostEndedBody', newMember.guild.id, { user: String(newMember) })
        )
        .addFields(
          { name: 'Boostov spolu', value: String(count), inline: true },
          { name: t(newMember.guild, 'field.serverLevel'), value: `Tier ${tier}`, inline: true }
        )
        .setThumbnail(newMember.user.displayAvatarURL())
    );
  });

  client.on('roleCreate', async (role) => {
    await sendLog(role.guild, 'roles', 'roleCreate',
      logEmbed(t(role.guild, 'title.roleCreated'), LOG_COLORS.create).addFields(
        { name: 'Rola', value: `${role} (\`${role.name}\`)`, inline: true },
        { name: 'Farba', value: role.hexColor, inline: true }
      )
    );
  });

  client.on('roleDelete', async (role) => {
    await sendLog(role.guild, 'roles', 'roleDelete',
      logEmbed(t(role.guild, 'title.roleDeleted'), LOG_COLORS.delete).addFields(
        { name: t(role.guild, 'field.name'), value: `\`${role.name}\``, inline: true },
        { name: t(role.guild, 'field.memberCountWas'), value: String(role.members.size), inline: true }
      )
    );
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`${t(newRole.guild, 'field.name')}: \`${oldRole.name}\` \u2192 \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`Farba: ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist) changes.push(newRole.hoist ? 'Zobrazuje sa samostatne' : t(newRole.guild, 'field.noLongerSeparate'));
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(t(newRole.guild, 'field.permsChanged'));
    if (changes.length === 0) return;

    await sendLog(newRole.guild, 'roles', 'roleUpdate',
      logEmbed(t(newRole.guild, 'title.roleUpdated'), LOG_COLORS.update)
        .setDescription(`${newRole}\n\n${changes.join('\n')}`)
    );
  });

  client.on('channelCreate', async (channel: any) => {
    if (!channel.guild) return;
    await sendLog(channel.guild, 'channels', 'channelCreate',
      logEmbed(t(channel.guild, 'title.channelCreated'), LOG_COLORS.create).addFields(
        { name: t(channel.guild, 'field.channel'), value: `${channel} (\`${channel.name}\`)`, inline: true },
        { name: t(channel.guild, 'field.type'), value: channelTypeName(channel.guild, channel.type), inline: true }
      ),
      { sourceChannelId: channel.id }
    );
  });

  client.on('channelDelete', async (channel: any) => {
    if (!channel.guild) return;
    await sendLog(channel.guild, 'channels', 'channelDelete',
      logEmbed(t(channel.guild, 'title.channelDeleted'), LOG_COLORS.delete).addFields(
        { name: t(channel.guild, 'field.name'), value: `\`${channel.name}\``, inline: true },
        { name: t(channel.guild, 'field.type'), value: channelTypeName(channel.guild, channel.type), inline: true }
      )
    );
  });

  client.on('channelUpdate', async (oldChannel: any, newChannel: any) => {
    if (!newChannel.guild) return;

    const changes: string[] = [];
    if (oldChannel.name !== newChannel.name) changes.push(`${t(newChannel.guild, 'field.name')}: \`${oldChannel.name}\` \u2192 \`${newChannel.name}\``);
    if (oldChannel.topic !== newChannel.topic) changes.push(t(newChannel.guild, 'field.topicChanged'));
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(newChannel.nsfw ? t(newChannel.guild, 'field.markedNsfw') : t(newChannel.guild, 'field.unmarkedNsfw'));
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`Slowmode: ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    }
    if (changes.length === 0) return;

    await sendLog(newChannel.guild, 'channels', 'channelUpdate',
      logEmbed(t(newChannel.guild, 'title.channelUpdated'), LOG_COLORS.update)
        .setDescription(`${newChannel}\n\n${changes.join('\n')}`),
      { sourceChannelId: newChannel.id }
    );
  });

  client.on('guildBanAdd', async (ban) => {
    await sendLog(ban.guild, 'moderation', 'ban',
      logEmbed(t(ban.guild, 'title.memberBanned'), LOG_COLORS.delete).addFields(
        { name: t(ban.guild, 'field.user'), value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: t(ban.guild, 'field.reason'), value: ban.reason || t(ban.guild, 'value.notSpecified'), inline: true }
      ).setThumbnail(ban.user.displayAvatarURL())
    );
  });

  client.on('guildBanRemove', async (ban) => {
    await sendLog(ban.guild, 'moderation', 'unban',
      logEmbed(t(ban.guild, 'title.banRevoked'), LOG_COLORS.create).addFields(
        { name: t(ban.guild, 'field.user'), value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true }
      ).setThumbnail(ban.user.displayAvatarURL())
    );
  });

  client.on('messageDelete', async (message: Message | PartialMessage) => {
    try {
      if (!message.guild || message.author?.bot || !message.content) return;

      const settings = await GuildSettings.findOne({ guildId: message.guild.id });
      if (settings?.automod?.ghostPing?.enabled !== true) return;

      const targets = extractMentionTargets(message.content);
      const mentionsEveryone = /@(everyone|here)/.test(message.content);
      if (targets.length === 0 && !mentionsEveryone) return;

      const maxAgeSeconds = Number(settings.automod.ghostPing.maxAgeSeconds || 30);
      const age = Date.now() - message.createdTimestamp;
      if (age > maxAgeSeconds * 1000) return;

      const mentionList = mentionsEveryone
        ? '@everyone / @here'
        : targets.map(id => `<@${id}>`).join(', ');

      await sendLog(message.guild, 'messages', 'ghostPing',
        logEmbed('👻 Ghost ping', LOG_COLORS.update)
          .setDescription(
            i18n.t('serverLogs.ghostPingBody', message.guild?.id, {
              user: message.author ? `<@${message.author.id}>` : t(message.guild, 'value.unknown')
            })
          )
          .addFields(
            { name: t(message.guild, 'field.channel'), value: `<#${message.channelId}>`, inline: true },
            { name: t(message.guild, 'field.mentionable'), value: mentionList.slice(0, 1000), inline: true },
            { name: 'Obsah', value: message.content.slice(0, 1000) }
          ),
        { sourceChannelId: message.channelId }
      );
    } catch (error) {
        logger.debug('serverLogs: suppressed error', error);
      }
  });
}
