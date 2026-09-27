/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Client,
  Events,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  StringSelectMenuInteraction,
  PermissionFlagsBits,
  Collection,
  MessageFlags
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { GuildSettings } from '../../utils/models.js';
import { commandAllowed, featureAllowed } from '../modules/channelGuard.js';
import { COMMAND_TO_GAME, isGameEnabled, resolveGameScopeFeature, getGame } from '../../utils/gameRegistry.js';
import { reportError } from '../../utils/errorReporter.js';
import { isEnvOwner } from '../../shared/ownerCheck.js';
import type { Event } from '../types.js';

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  execute: async (client: Client, interaction) => {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(client, interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleCommand(client, interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'rolemenu_single' || interaction.customId === 'rolemenu_multi') {
        await handleRoleMenuSelect(interaction);
      }
      return;
    }
  }
};

async function safeReply(
  interaction: ChatInputCommandInteraction,
  payload: Parameters<ChatInputCommandInteraction['reply']>[0]
): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload as any);
    } else {
      await interaction.reply(payload as any);
    }
  } catch (error) {
    reportError('interactionCreate:reply', error, { command: interaction.commandName });
  }
}

async function handleRoleMenuSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    reportError('interactionCreate:rolemenu:defer', error);
    return;
  }

  try {
    if (!interaction.guild) {
      await interaction.editReply({ content: '❌ This menu only works on a server.' });
      return;
    }

    const chosen = interaction.values.filter((v) => v !== 'none' && /^\d+$/.test(v));
    if (chosen.length === 0) {
      await interaction.editReply({ content: 'ℹ️ No change.' });
      return;
    }

    const me = interaction.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.editReply({ content: '❌ I am missing the **Manage Roles** permission.' });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);

    const menuRoleIds = interaction.component.options
      .map((o) => o.value)
      .filter((v) => v !== 'none' && /^\d+$/.test(v));

    const canManage = (roleId: string): boolean => {
      const role = interaction.guild!.roles.cache.get(roleId);
      return !!role && role.position < me.roles.highest.position;
    };

    const added: string[] = [];
    const removed: string[] = [];
    const denied: string[] = [];

    const nameOf = (roleId: string) => interaction.guild!.roles.cache.get(roleId)?.name || roleId;

    if (interaction.customId === 'rolemenu_single') {
      const target = chosen[0];
      if (!canManage(target)) {
        await interaction.editReply({ content: `❌ I cannot assign **${nameOf(target)}** - my own role must be placed **above** it in Server Settings → Roles.` });
        return;
      }

      for (const otherId of menuRoleIds) {
        if (otherId === target) continue;
        if (!member.roles.cache.has(otherId) || !canManage(otherId)) continue;
        await member.roles.remove(otherId);
        removed.push(nameOf(otherId));
      }

      if (member.roles.cache.has(target)) {
        await member.roles.remove(target);
        removed.push(nameOf(target));
      } else {
        await member.roles.add(target);
        added.push(nameOf(target));
      }
    } else {
      for (const roleId of chosen) {
        if (!canManage(roleId)) { denied.push(nameOf(roleId)); continue; }
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          removed.push(nameOf(roleId));
        } else {
          await member.roles.add(roleId);
          added.push(nameOf(roleId));
        }
      }
    }

    const lines: string[] = [];
    if (added.length) lines.push(`✅ Added: ${added.map((n) => `**${n}**`).join(', ')}`);
    if (removed.length) lines.push(`➖ Removed: ${removed.map((n) => `**${n}**`).join(', ')}`);
    if (denied.length) lines.push(`❌ Could not manage: ${denied.map((n) => `**${n}**`).join(', ')} (my role must be above them)`);
    await interaction.editReply({ content: lines.join('\n') || 'ℹ️ No change.' });
  } catch (error: any) {
    logger.error('Error handling role menu select:', error);
    const content = error?.code === 50013
      ? '❌ I could not change the role - make sure my role is **above** it in the role list and I have **Manage Roles**.'
      : '❌ An error occurred while changing the role.';
    try {
      await interaction.editReply({ content });
    } catch (error) {
      logger.debug('interactionCreate: suppressed error', error);
    }
  }
}

async function handleCommand(
  client: Client,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    await safeReply(interaction, {
      embeds: [EmbedHelper.error('Error', 'Command not found.')],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const guildId = interaction.guildId || 'dm';

  if (command.guildOnly && !interaction.guild) {
    await safeReply(interaction, {
      embeds: [EmbedHelper.error('Error', i18n.t('common.guildOnly', guildId))],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (command.ownerOnly && !isEnvOwner(interaction.user.id)) {
    await safeReply(interaction, {
      embeds: [EmbedHelper.error('Error', i18n.t('common.ownerOnly', guildId))],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.guild && interaction.channel) {
    try {
      const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
      if (settings && !commandAllowed(settings, command.data.name, command.category, interaction.channel)) {
        await safeReply(interaction, {
          embeds: [EmbedHelper.error(
            'Nesprávny kanál',
            i18n.t('common.wrongChannel', guildId)
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const gameKey = settings ? COMMAND_TO_GAME[command.data.name] : undefined;
      if (settings && gameKey) {
        if (!isGameEnabled(settings, gameKey)) {
          await safeReply(interaction, {
            embeds: [EmbedHelper.error(
              'Hra je vypnutá',
              `**${getGame(gameKey)?.label || gameKey}** je na tomto serveri vypnutá.`
            )],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const scopeFeature = resolveGameScopeFeature(settings, gameKey);
        if (!featureAllowed(settings, scopeFeature, interaction.channel)) {
          await safeReply(interaction, {
            embeds: [EmbedHelper.error(
              'Nesprávny kanál',
              i18n.t('common.wrongChannel', guildId)
            )],
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }
    } catch (error) {
      logger.error('Channel scope check failed:', error as Error);
    }
  }

  if (command.permissions && interaction.guild) {
    const member = interaction.member
      ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
      : null;
    if (!member || !member.permissions.has(command.permissions)) {
      await safeReply(interaction, {
        embeds: [EmbedHelper.error('Error', i18n.t('common.noPermission', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }

  if (command.botPermissions && interaction.guild) {
    const botMember = await interaction.guild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(command.botPermissions)) {
      await safeReply(interaction, {
        embeds: [EmbedHelper.error('Error', i18n.t('common.botNoPermission', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }

  if (command.cooldown) {
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name)!;
    const cooldownAmount = command.cooldown * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        await safeReply(interaction, {
          embeds: [EmbedHelper.warning(
            'Cooldown',
            i18n.t('common.cooldown', guildId, { time: `${timeLeft}s` })
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error as Error);

    const errorEmbed = EmbedHelper.error(
      'Error',
      i18n.t('common.unknownError', guildId)
    );

    await safeReply(interaction, { embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleAutocomplete(
  client: Client,
  interaction: AutocompleteInteraction
): Promise<void> {
  const command = client.commands.get(interaction.commandName);

  if (!command || !command.autocomplete) return;

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    logger.error(`Error in autocomplete ${interaction.commandName}:`, error as Error);
  }
}

export default event;
