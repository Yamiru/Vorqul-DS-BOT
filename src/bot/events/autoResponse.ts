/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Message, EmbedBuilder, TextChannel } from 'discord.js';
import { getDatabase } from '../../utils/database.js';
import { GuildSettings } from '../../utils/models.js';
import { featureAllowed } from '../modules/channelGuard.js';
import { isModuleEnabled } from '../../shared/settingsSchema.js';
import { reportError } from '../../utils/errorReporter.js';
import { logger } from '../../utils/logger.js';

const cooldowns = new Map<string, Map<string, number>>();
const COOLDOWN_MAX_AGE_MS = 60 * 60 * 1000;

const cooldownSweeper = setInterval(() => {
  const now = Date.now();
  for (const [guildId, guildCooldowns] of cooldowns) {
    for (const [key, at] of guildCooldowns) {
      if (now - at > COOLDOWN_MAX_AGE_MS) guildCooldowns.delete(key);
    }
    if (guildCooldowns.size === 0) cooldowns.delete(guildId);
  }
}, 10 * 60 * 1000);
cooldownSweeper.unref?.();

export default function autoResponseHandler(client: Client) {
  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: message.guild.id });

      if (!isModuleEnabled(settings, 'autoResponse', false)) return;
      if (!featureAllowed(settings, 'autoResponse', message.channel)) return;

      const db = getDatabase();
      const stored = await db.find('auto_responses', {
        guild_id: message.guild.id,
        enabled: true
      });

      const fromSettings = Array.isArray((settings as any)?.autoResponses)
        ? (settings as any).autoResponses
            .filter((ar: any) => ar && ar.trigger && ar.response)
            .map((ar: any, index: number) => ({
              id: `settings-${index}`,
              trigger_text: String(ar.trigger),
              response: String(ar.response),
              use_regex: Boolean(ar.useRegex),
              required_roles: null,
              blacklist_roles: null,
              cooldown: Number(ar.cooldown) || 0,
              delete_trigger: Boolean(ar.deleteTrigger),
              dm_response: Boolean(ar.dmResponse),
              response_type: ar.responseType || 'text',
              embed_config: ar.embedConfig || null
            }))
        : [];

      const autoResponses = [...stored, ...fromSettings];

      if (autoResponses.length === 0) return;

      const content = message.content.toLowerCase();
      const member = message.member;

      for (const ar of autoResponses) {
        let matches = false;

        if (ar.use_regex) {
          try {
            const regex = new RegExp(ar.trigger_text, 'i');
            matches = regex.test(message.content);
          } catch {
            continue;
          }
        } else {
          matches = content.includes(ar.trigger_text.toLowerCase());
        }

        if (!matches) continue;

        if (ar.required_roles) {
          const requiredRoles = JSON.parse(ar.required_roles || '[]');
          if (requiredRoles.length > 0) {
            const hasRole = requiredRoles.some((roleId: string) =>
              member?.roles.cache.has(roleId)
            );
            if (!hasRole) continue;
          }
        }

        if (ar.blacklist_roles) {
          const blacklistRoles = JSON.parse(ar.blacklist_roles || '[]');
          if (blacklistRoles.length > 0) {
            const hasBlacklistedRole = blacklistRoles.some((roleId: string) =>
              member?.roles.cache.has(roleId)
            );
            if (hasBlacklistedRole) continue;
          }
        }

        if (ar.cooldown && ar.cooldown > 0) {
          const guildCooldowns = cooldowns.get(message.guild.id) || new Map();
          const lastUsed = guildCooldowns.get(`${ar.id}-${message.author.id}`) || 0;
          const now = Date.now();

          if (now - lastUsed < ar.cooldown * 1000) continue;

          guildCooldowns.set(`${ar.id}-${message.author.id}`, now);
          cooldowns.set(message.guild.id, guildCooldowns);
        }

        if (ar.delete_trigger) {
          try {
            await message.delete();
          } catch (error) {
            reportError('autoResponse:deleteTrigger', error, { channelId: message.channel.id });
          }
        }

        const responseText = ar.response
          .replace(/{user}/g, `<@${message.author.id}>`)
          .replace(/{username}/g, message.author.username)
          .replace(/{server}/g, message.guild.name)
          .replace(/{channel}/g, `<#${message.channel.id}>`);

        if (ar.dm_response) {
          try {
            await message.author.send(responseText);
          } catch (error) {
            reportError('autoResponse:dmResponse', error, { userId: message.author.id });
          }
        } else {
          if (ar.response_type === 'embed' && ar.embed_config) {
            try {
              const embedConfig = JSON.parse(ar.embed_config);
              const embed = new EmbedBuilder()
                .setDescription(responseText)
                .setColor(embedConfig.color || 0x3498DB);

              if (embedConfig.title) embed.setTitle(embedConfig.title);
              if (embedConfig.footer) embed.setFooter({ text: embedConfig.footer });

              await (message.channel as TextChannel).send({ embeds: [embed] });
            } catch {
              await (message.channel as TextChannel).send(responseText);
            }
          } else {
            await (message.channel as TextChannel).send(responseText);
          }
        }

        break;
      }
    } catch (error) {
      logger.error('Auto response error:', error);
    }
  });
}
