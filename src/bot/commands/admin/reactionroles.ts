/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { reportError } from '../../../utils/errorReporter.js';
import { getDangerousRolePermissions } from '../../../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a reaction role to a message')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('Message ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji pre reakciu')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('rola')
            .setDescription('Rola na pridanie')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a reaction role')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('Message ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all reaction roles')
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new reaction role message')
        .addStringOption(opt =>
          opt.setName('title')
            .setDescription('Nadpis')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('description')
            .setDescription('Popis')
            .setRequired(true)
        )
    ),

  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'add') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);
      const role = interaction.options.getRole('rola', true);

      const dangerous = getDangerousRolePermissions(role.permissions as any);
      if (dangerous.length > 0) {
        return interaction.reply({
          content: `❌ **${role.name}** has sensitive permissions (${dangerous.join(', ')}) and cannot be offered as a self-assignable reaction role.`,
          flags: MessageFlags.Ephemeral
        });
      }

      let message;
      for (const channel of interaction.guild!.channels.cache.values()) {
        if (!channel.isTextBased()) continue;
        try {
          message = await (channel as TextChannel).messages.fetch(messageId);
          if (message) break;
        } catch (error) {
          reportError('reactionroles:findMessage', error, { channelId: channel.id, messageId });
        }
      }

      if (!message) {
        return interaction.reply({
          content: '❌ Message not found.',
          flags: MessageFlags.Ephemeral
        });
      }

      try {
        await message.react(emoji);
      } catch {
        return interaction.reply({
          content: '❌ Could not add the reaction. Check that the emoji is valid.',
          flags: MessageFlags.Ephemeral
        });
      }

      await db.upsert('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: messageId,
        channel_id: message.channel.id,
        emoji: emoji,
        role_id: role.id
      }, ['message_id', 'emoji']);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Reaction Role added')
            .addFields(
              { name: 'Emoji', value: emoji, inline: true },
              { name: 'Rola', value: `${role}`, inline: true },
              { name: 'Message', value: `[Link](${message.url})`, inline: true }
            )
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);

      const deleted = await db.delete('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: messageId,
        emoji: emoji
      });

      if (!deleted) {
        return interaction.reply({
          content: '❌ Reaction role not found.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.reply({
        content: '✅ The reaction role has been removed.',
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'list') {
      const roles = await db.find('reaction_roles_config', { guild_id: interaction.guildId });

      if (roles.length === 0) {
        return interaction.reply({
          content: '📭 No reaction roles are set up.',
          flags: MessageFlags.Ephemeral
        });
      }

      const grouped = new Map<string, any[]>();
      for (const role of roles) {
        const existing = grouped.get(role.message_id) || [];
        existing.push(role);
        grouped.set(role.message_id, existing);
      }

      const embed = new EmbedBuilder()
        .setTitle('🎭 Reaction Roles')
        .setColor(0x9B59B6);

      for (const [messageId, rrs] of grouped) {
        const lines = rrs.map((r: any) => `${r.emoji} → <@&${r.role_id}>`);
        embed.addFields({
          name: `Message: ${messageId}`,
          value: lines.join('\n'),
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'create') {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x3498DB)
        .setFooter({ text: 'React to get the role!' });

      const message = await (interaction.channel as TextChannel).send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Message created! ID: \`${message.id}\`\n\nUse \`/reactionroles add\` to add reactions.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
