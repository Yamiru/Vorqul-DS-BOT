/*!
 * Vorqul DS BOT - Command Group
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { ApplicationCommandOptionType, ChatInputCommandInteraction, Collection, MessageFlags } from 'discord.js';
import type { Command } from '../types.js';
import { isCommandAllowedInChannel } from '../../utils/channelScope.js';
import { GuildSettings } from '../../utils/models.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { i18n } from '../../utils/i18n.js';
import { reportError } from '../../utils/errorReporter.js';
import { isEnvOwner } from '../../shared/ownerCheck.js';

export type CommandGroupChild = Command | { command: Command; as: string };

export interface CommandGroupOptions {
  name: string;
  description: string;
  category: string;
  children: CommandGroupChild[];
}

function unwrap(child: CommandGroupChild): { command: Command; as?: string } {
  return 'command' in child ? { command: child.command, as: child.as } : { command: child };
}

const aliasMap = new Map<string, { group: string; path: string[] }>();

export function registerGroupAlias(child: string, group: string, path: string[]): void {
  aliasMap.set(child.toLowerCase(), { group, path });
}

export function resolveGroupedCommand(name: string): { group: string; path: string[] } | undefined {
  return aliasMap.get(name.toLowerCase());
}

export function groupedCommandNames(): string[] {
  return [...aliasMap.keys()];
}

export function buildCommandGroup(options: CommandGroupOptions): Command {
  const { name, description, category, children } = options;

  const byKey = new Map<string, { command: Command; original: string }>();
  const jsonOptions: any[] = [];

  for (const entry of children) {
    const { command: child, as } = unwrap(entry);
    const json: any = child.data.toJSON();
    const originalName = json.name;
    const childName = as || originalName;
    const childOptions: any[] = json.options || [];

    const hasSubcommands = childOptions.some(
      (o) =>
        o.type === ApplicationCommandOptionType.Subcommand ||
        o.type === ApplicationCommandOptionType.SubcommandGroup
    );

    if (hasSubcommands) {
      const nested = childOptions.filter(
        (o) => o.type === ApplicationCommandOptionType.SubcommandGroup
      );
      if (nested.length > 0) {
        throw new Error(
          `Príkaz ${originalName} má vlastné skupiny podpríkazov a nedá sa vnoriť pod /${name}.`
        );
      }

      jsonOptions.push({
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: childName,
        description: json.description,
        options: childOptions,
      });
    } else {
      jsonOptions.push({
        type: ApplicationCommandOptionType.Subcommand,
        name: childName,
        description: json.description,
        options: childOptions,
      });
    }

    if (byKey.has(childName)) {
      throw new Error(`/${name} má dva podpríkazy s menom ${childName}.`);
    }

    byKey.set(childName, { command: child, original: originalName });
    registerGroupAlias(originalName, name, [childName]);
  }

  if (jsonOptions.length > 25) {
    throw new Error(`/${name} má ${jsonOptions.length} podpríkazov, Discord povolí najviac 25.`);
  }

  const payload = {
    name,
    description,
    options: jsonOptions,
  };

  const data = {
    name,
    description,
    options: jsonOptions,
    toJSON: () => payload,
  };

  return {
    data: data as unknown as Command['data'],
    category,
    guildOnly: children.every((entry) => unwrap(entry).command.guildOnly),

    execute: async (interaction: ChatInputCommandInteraction) => {
      const groupName = interaction.options.getSubcommandGroup(false);
      const key = groupName || interaction.options.getSubcommand();
      const entry = byKey.get(key);

      if (!entry) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Chyba', `Podpríkaz \`${key}\` neexistuje.`)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { command: child, original } = entry;
      const guildId = interaction.guildId || undefined;

      if (child.guildOnly && !interaction.guild) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Chyba', i18n.t('common.guildOnly', guildId))],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (child.ownerOnly && !isEnvOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Chyba', i18n.t('common.ownerOnly', guildId))],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (child.permissions && interaction.guild) {
        const member = await interaction.guild.members
          .fetch(interaction.user.id)
          .catch(() => null);
        if (!member || !member.permissions.has(child.permissions)) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Chyba', i18n.t('common.noPermission', guildId))],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (child.botPermissions && interaction.guild) {
        const botMember = await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(child.botPermissions)) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Chyba', i18n.t('common.botNoPermission', guildId))],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (child.cooldown) {
        const cooldownKey = `group:${original}`;
        if (!interaction.client.cooldowns.has(cooldownKey)) {
          interaction.client.cooldowns.set(cooldownKey, new Collection());
        }

        const now = Date.now();
        const timestamps = interaction.client.cooldowns.get(cooldownKey)!;
        const cooldownAmount = child.cooldown * 1000;

        if (timestamps.has(interaction.user.id)) {
          const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

          if (now < expirationTime) {
            const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
            await interaction.reply({
              embeds: [EmbedHelper.warning('Cooldown', i18n.t('common.cooldown', guildId, { time: `${timeLeft}s` }))],
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
      }

      if (interaction.guild && interaction.channel) {
        try {
          const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
          const channel: any = interaction.channel;

          const allowed = isCommandAllowedInChannel(settings, original, child.category, {
            channelId: channel.id,
            parentIds: [channel.parentId, channel.parent?.parentId],
          });
          if (!allowed) {
            await interaction.reply({
              embeds: [EmbedHelper.error('Nesprávny kanál', i18n.t('common.wrongChannel', guildId))],
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        } catch (error) {
          reportError('commandGroup:scopeCheck', error, { group: name, child: original });
        }
      }

      await child.execute(interaction);
    },
  };
}
