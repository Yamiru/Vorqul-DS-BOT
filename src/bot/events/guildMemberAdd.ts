/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { GuildSettings } from '../../utils/models.js';
import { getDatabase } from '../../utils/database.js';
import { generateWelcomeCard } from '../../utils/welcomeCard.js';
import { buildConfiguredMessage } from '../../utils/messageRender.js';
import type { Event } from '../types.js';
import { reportError } from '../../utils/errorReporter.js';

const inviteCache = new Map<string, Map<string, number>>();

export async function initInviteCache(client: Client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      const guildInvites = new Map<string, number>();
      invites.forEach(inv => guildInvites.set(inv.code, inv.uses || 0));
      inviteCache.set(guild.id, guildInvites);
    } catch (error) {
      reportError('guildMemberAdd:initInviteCache', error, { guildId: guild.id });
    }
  }
}

export function updateInviteCache(guildId: string, code: string, uses: number) {
  const guildInvites = inviteCache.get(guildId) || new Map();
  guildInvites.set(code, uses);
  inviteCache.set(guildId, guildInvites);
}

const event: Event<typeof Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  execute: async (client: Client, member: GuildMember) => {
    const db = getDatabase();

    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      const modules = settings?.modules || {};
      const guildId = member.guild.id;

      if (modules.invites?.enabled) {
        try {
          const newInvites = await member.guild.invites.fetch();
          const oldInvites = inviteCache.get(guildId) || new Map();

          const usedInvite = newInvites.find(inv => {
            const oldUses = oldInvites.get(inv.code) || 0;
            return inv.uses! > oldUses;
          });

          if (usedInvite?.inviter && !member.user.bot) {
            await db.insert('invites_tracking', {
              guild_id: guildId,
              inviter_id: usedInvite.inviter.id,
              invited_id: member.id,
              bonus_invites: 0
            });

            const guildInvites = new Map<string, number>();
            newInvites.forEach(inv => guildInvites.set(inv.code, inv.uses || 0));
            inviteCache.set(guildId, guildInvites);

            if (modules.invites.rewards?.length > 0) {
              const inviteCount = await db.query(
                `SELECT COUNT(*) as count FROM invites_tracking WHERE guild_id = ? AND inviter_id = ?`,
                [guildId, usedInvite.inviter.id]
              );
              const count = inviteCount[0]?.count || 0;

              for (const reward of modules.invites.rewards) {
                if (count >= reward.invites && reward.role) {
                  try {
                    const inviter = await member.guild.members.fetch(usedInvite.inviter.id);
                    if (!inviter.roles.cache.has(reward.role)) {
                      await inviter.roles.add(reward.role);
                    }
                  } catch (error) {
                    reportError('guildMemberAdd:inviteReward', error, { guildId: member.guild.id, roleId: reward.role });
                  }
                }
              }
            }
          }
        } catch (error) {
          reportError('guildMemberAdd:inviteTracking', error, { guildId: member.guild.id });
        }
      }

      if (modules.joinRoles?.enabled && modules.joinRoles.roles?.length > 0) {
        const delay = modules.joinRoles.delay || 0;

        setTimeout(async () => {
          try {
            const roles = member.user.bot
              ? modules.joinRoles.botRoles || []
              : modules.joinRoles.roles;

            for (const roleId of roles) {
              const role = member.guild.roles.cache.get(roleId);
              if (role) {
                await member.roles.add(role);
              }
            }
          } catch (error) {
            reportError('guildMemberAdd:joinRoles', error, { guildId: member.guild.id, userId: member.id });
          }
        }, delay * 1000);
      }

      if (modules.verification?.enabled && modules.verification.unverifiedRole) {
        try {
          await member.roles.add(modules.verification.unverifiedRole);
        } catch (error) {
          reportError('guildMemberAdd:unverifiedRole', error, { guildId: member.guild.id, userId: member.id });
        }
      }

      if ((settings?.welcomeChannel || modules.welcome?.channel) && modules.welcome?.enabled !== false) {
       try {
        const channelId = settings?.welcomeChannel || modules.welcome?.channel;
        const channel = member.guild.channels.cache.get(channelId) as TextChannel;

        if (channel) {
          const replacements = {
            user: member.toString(),
            username: member.user.username,
            server: member.guild.name,
            count: member.guild.memberCount.toString(),
            memberCount: member.guild.memberCount.toString()
          };

          let inviterText = '';
          if (modules.invites?.enabled) {
            const inviteData = await db.findOne('invites_tracking', {
              guild_id: guildId,
              invited_id: member.id
            });
            if (inviteData?.inviter_id) {
              inviterText = `<@${inviteData.inviter_id}>`;
            }
          }

          const welcomeMessage = settings?.welcomeMessage || modules.welcome?.message ||
            i18n.t('welcome.defaultMessage', guildId);

          let message = welcomeMessage;
          for (const [key, value] of Object.entries(replacements)) {
            message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), () => value);
          }
          message = message.replace(/{inviter}/g, () => inviterText || 'Unknown');

          const files: AttachmentBuilder[] = [];
          const cardCfg = (settings as any)?.welcomeCard;
          const cardOn = cardCfg?.enabled ?? modules.welcome?.cardEnabled ?? false;
          if (cardOn) {
            const applyVars = (tpl: string) => {
              let out = tpl;
              for (const [key, value] of Object.entries(replacements)) {
                out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), () => value);
              }
              return out;
            };
            const titleTpl = cardCfg?.title || 'Vitaj, {username}!';
            const subtitleTpl = cardCfg?.subtitle || '{count}. member of {server}';
            const card = await generateWelcomeCard({
              avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
              title: applyVars(titleTpl),
              subtitle: applyVars(subtitleTpl),
              backgroundUrl: cardCfg?.backgroundUrl || undefined,
              backgroundColor: cardCfg?.backgroundColor || undefined,
              textColor: cardCfg?.textColor || undefined,
              accentColor: cardCfg?.accentColor || undefined
            });
            if (card) {
              files.push(new AttachmentBuilder(card, { name: 'welcome.png' }));
            }
          }

          const avatarUrl = member.user.displayAvatarURL({ size: 256 });
          const vars = { ...replacements, avatar: avatarUrl, inviter: inviterText || 'Unknown' };

          const welcomeEmbedCfg: any = (settings as any)?.welcomeEmbed || {};
          const welcomeIsEmbed = welcomeEmbedCfg.enabled === true || modules.welcome?.embedEnabled === true;

          const rendered = buildConfiguredMessage(
            welcomeIsEmbed ? 'embed' : 'plain',
            { ...welcomeEmbedCfg, message },
            vars,
            { plainText: message, title: '👋 Welcome to the server!', description: message, color: 0x00ff00, thumbnail: avatarUrl }
          );

          const sendOpts: any = { files };
          if (rendered.content) sendOpts.content = rendered.content;
          if (rendered.embeds && rendered.embeds.length) {
            const embed = rendered.embeds[0];
            if (inviterText) embed.addFields({ name: '📨 Invited by', value: inviterText, inline: true });

            if (files.length > 0) embed.setImage('attachment://welcome.png');
            sendOpts.embeds = [embed];
          }

          if (!sendOpts.content && !sendOpts.embeds) sendOpts.content = message;
          await channel.send(sendOpts);
        }
       } catch (error) {
         reportError('guildMemberAdd:welcomeMessage', error, { guildId: member.guild.id, userId: member.id });
       }
      }

      const dmCfg: any = (settings as any)?.welcomeDM || {};
      const dmEnabled = dmCfg.enabled === true || modules.welcome?.dmEnabled === true;
      const dmText: string | undefined = dmCfg.message || modules.welcome?.dmMessage;
      if (dmEnabled && (dmText || dmCfg.description)) {
        try {
          const dmVars = {
            user: member.user.username,
            username: member.user.username,
            server: member.guild.name,
            count: member.guild.memberCount.toString(),
            memberCount: member.guild.memberCount.toString(),
            avatar: member.user.displayAvatarURL({ size: 256 }),
          };
          const dmIsEmbed = dmCfg.embedEnabled === true || dmCfg.embed === true;
          const dmRendered = buildConfiguredMessage(
            dmIsEmbed ? 'embed' : 'plain',
            { ...dmCfg, message: dmText },
            dmVars,
            { plainText: dmText, description: dmText, color: 0x5865f2 }
          );
          const dmOpts: any = {};
          if (dmRendered.content) dmOpts.content = dmRendered.content;
          if (dmRendered.embeds) dmOpts.embeds = dmRendered.embeds;
          if (!dmOpts.content && !dmOpts.embeds) dmOpts.content = dmText;
          await member.send(dmOpts);
        } catch (error) {
          reportError('guildMemberAdd:welcomeDM', error, { guildId: member.guild.id, userId: member.id });
        }
      }

      const logChannelId = modules.logs?.channels?.members || settings?.logChannels?.members;
      if (logChannelId && (modules.logs?.enabled || settings?.logChannels?.members)) {
        const logChannel = member.guild.channels.cache.get(logChannelId) as TextChannel;

        if (logChannel && modules.logs?.events?.memberJoin !== false) {
          const embed = EmbedHelper.info(i18n.t('logging.memberJoined', guildId))
            .setDescription([
              `**${i18n.t('common.user', guildId)}:** ${member.user.tag}`,
              `**ID:** ${member.id}`,
              `**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
              `**Members on the server:** ${member.guild.memberCount}`
            ].join('\n'))
            .setThumbnail(member.user.displayAvatarURL())
            .setColor(0x00FF00)
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      }

    } catch (error) {
      logger.error('Error in guildMemberAdd event:', error as Error);
    }
  }
};

export default event;
