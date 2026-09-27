/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Message, Collection, EmbedBuilder } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { commandAllowed } from '../modules/channelGuard.js';
import { featureAllowed } from '../modules/channelGuard.js';
import { COMMAND_TO_GAME, isGameEnabled, resolveGameScopeFeature, getGame } from '../../utils/gameRegistry.js';
import { resolveGroupedCommand } from '../modules/commandGroup.js';
import { isEnvOwner } from '../../shared/ownerCheck.js';
import {
  tokenize,
  buildPrefixInteraction,
  argumentErrorEmbed,
  usageHint,
  PrefixArgumentError,
  PrefixUnsupportedError,
} from '../modules/prefixBridge.js';
import type { Command } from '../types.js';
import { suppress } from '../../utils/suppress.js';

const DEFAULT_PREFIX = process.env.BOT_PREFIX || '!';

export function resolvePrefix(settings: any): string {
  const raw = settings?.prefix;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return DEFAULT_PREFIX;
}

function resolveCommand(
  client: Client,
  name: string,
  settings: any,
  tokens: string[]
): Command | undefined {
  const direct = client.commands.get(name);
  if (direct) return direct;

  const grouped = resolveGroupedCommand(name);
  if (grouped) {
    const group = client.commands.get(grouped.group);
    if (group) {
      tokens.unshift(...grouped.path);
      return group;
    }
  }

  const aliases = settings?.prefixCommands?.aliases;
  if (aliases && typeof aliases === 'object') {
    const target = aliases[name];
    if (typeof target === 'string') {
      const aliased = client.commands.get(target);
      if (aliased) return aliased;

      const groupedAlias = resolveGroupedCommand(target);
      if (groupedAlias) {
        const group = client.commands.get(groupedAlias.group);
        if (group) {
          tokens.unshift(...groupedAlias.path);
          return group;
        }
      }
    }
  }
  return undefined;
}

export default function prefixCommandHandler(client: Client) {
  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: message.guild.id });

      if (settings?.prefixCommands?.enabled === false) return;

      const prefix = resolvePrefix(settings);
      const mentionPattern = new RegExp(`^<@!?${client.user?.id}>\\s*`);

      let body: string | null = null;

      if (message.content.startsWith(prefix)) {
        body = message.content.slice(prefix.length);
      } else if (mentionPattern.test(message.content)) {
        body = message.content.replace(mentionPattern, '');
      }

      if (body === null) return;

      const tokens = tokenize(body.trim());
      if (tokens.length === 0) return;

      const commandName = tokens.shift()!.toLowerCase();
      const command = resolveCommand(client, commandName, settings, tokens);
      if (!command) return;

      const guildId = message.guild.id;

      if (command.ownerOnly && !isEnvOwner(message.author.id)) {
        await message.reply({
          embeds: [EmbedHelper.error('Chyba', i18n.t('common.ownerOnly', guildId))],
        });
        return;
      }

      if (settings && !commandAllowed(settings, command.data.name, command.category, message.channel)) {
        await message.reply({
          embeds: [EmbedHelper.error('Nesprávny kanál', i18n.t('common.wrongChannel', guildId))],
        });
        return;
      }

      const gameKey = settings ? COMMAND_TO_GAME[command.data.name] : undefined;
      if (settings && gameKey) {
        if (!isGameEnabled(settings, gameKey)) {
          await message.reply({
            embeds: [EmbedHelper.error(
              'Hra je vypnutá',
              `**${getGame(gameKey)?.label || gameKey}** je na tomto serveri vypnutá.`
            )],
          });
          return;
        }

        const scopeFeature = resolveGameScopeFeature(settings, gameKey);
        if (!featureAllowed(settings, scopeFeature, message.channel)) {
          await message.reply({
            embeds: [EmbedHelper.error('Nesprávny kanál', i18n.t('common.wrongChannel', guildId))],
          });
          return;
        }
      }

      if (command.permissions && !message.member?.permissions.has(command.permissions)) {
        await message.reply({
          embeds: [EmbedHelper.error('Chyba', i18n.t('common.noPermission', guildId))],
        });
        return;
      }

      if (command.botPermissions) {
        const me = message.guild.members.me;
        if (!me || !me.permissions.has(command.botPermissions)) {
          await message.reply({
            embeds: [EmbedHelper.error('Chyba', i18n.t('common.botNoPermission', guildId))],
          });
          return;
        }
      }

      if (command.cooldown) {
        if (!client.cooldowns.has(command.data.name)) {
          client.cooldowns.set(command.data.name, new Collection());
        }
        const timestamps = client.cooldowns.get(command.data.name)!;
        const cooldownMs = command.cooldown * 1000;
        const now = Date.now();
        const previous = timestamps.get(message.author.id);

        if (previous && now < previous + cooldownMs) {
          const timeLeft = ((previous + cooldownMs - now) / 1000).toFixed(1);
          const reply = await message.reply({
            embeds: [
              EmbedHelper.warning(
                'Cooldown',
                i18n.t('common.cooldown', guildId, { time: `${timeLeft}s` })
              ),
            ],
          });
          setTimeout(() => reply.delete().catch(suppress('prefixCommands')), 5000);
          return;
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownMs);
      }

      const interaction = buildPrefixInteraction(client, message, command, tokens);
      await command.execute(interaction);
    } catch (error) {
      if (error instanceof PrefixArgumentError) {
        const settings = await GuildSettings.findOne({ guildId: message.guild.id }).catch(() => null);
        const prefix = resolvePrefix(settings);
        const name = tokenize(message.content.slice(prefix.length))[0]?.toLowerCase();
        const command = name ? client.commands.get(name) : undefined;

        await message.reply({
          embeds: [
            command
              ? argumentErrorEmbed(error, command, prefix)
              : new EmbedBuilder().setColor(0xed4245).setDescription(error.message),
          ],
        }).catch(suppress('prefixCommands'));
        return;
      }

      if (error instanceof PrefixUnsupportedError) {
        await message.reply({
          embeds: [EmbedHelper.warning('Nedostupné cez prefix', error.message)],
        }).catch(suppress('prefixCommands'));
        return;
      }

      logger.error('Error in prefix command handler:', error as Error);
      await message.reply({
        embeds: [EmbedHelper.error('Chyba', 'Príkaz sa nepodarilo vykonať.')],
      }).catch(suppress('prefixCommands'));
    }
  });

  logger.info(`Prefix commands ready (default prefix: ${DEFAULT_PREFIX})`);
}

export { usageHint };
