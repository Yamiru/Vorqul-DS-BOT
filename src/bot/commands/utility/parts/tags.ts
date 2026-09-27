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
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
  GuildMemberRoleManager,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { GuildSettings, TagRole } from '../../../../utils/models.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';
import { suppress } from '../../../../utils/suppress.js';
import { getDangerousRolePermissions } from '../../../../utils/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tags')
    .setDescription('Self-assignable tag roles')
    .addSubcommand(sub =>
      sub.setName('menu').setDescription('Open tag roles menu')
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a tag role (Admin)')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to add as tag').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('category').setDescription('Category (e.g., Interests, Games)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji for the role').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('description').setDescription('Role description').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a tag role (Admin)')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to remove from tags').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all tag roles')
    )
    .addSubcommand(sub =>
      sub
        .setName('text')
        .setDescription('Show a saved text tag')
        .addStringOption(opt =>
          opt.setName('nazov').setDescription('Tag name (leave empty to list them all)').setRequired(false)
        )
    ),

  category: 'utility',

  cooldown: 5,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case 'menu': {
        const tags = await TagRole.find({ guildId });

        if (tags.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Tag Roles', 'No tag roles configured yet.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const categories = new Map<string, typeof tags>();
        for (const tag of tags) {
          if (!categories.has(tag.category)) {
            categories.set(tag.category, []);
          }
          categories.get(tag.category)!.push(tag);
        }

        const embed = new EmbedBuilder()
          .setTitle('🏷️ Tag Roles')
          .setDescription('Select roles that match your interests!')
          .setColor(config.bot.embedColor as `#${string}`);

        const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

        for (const [category, categoryTags] of categories) {
          embed.addFields({
            name: category,
            value: categoryTags.map(t => `${t.emoji || '•'} <@&${t.roleId}>`).join('\n'),
            inline: true
          });

          if (rows.length < 5) {
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`tag_role_${category.toLowerCase().replace(/\s/g, '_')}`)
              .setPlaceholder(`Select ${category}`)
              .setMinValues(0)
              .setMaxValues(categoryTags.length)
              .addOptions(
                categoryTags.map(t => {
                  const memberRoles = interaction.member?.roles;
                  const hasRole = memberRoles instanceof GuildMemberRoleManager
                    ? memberRoles.cache.has(t.roleId)
                    : Array.isArray(memberRoles) && memberRoles.includes(t.roleId);
                  return {
                    label: interaction.guild!.roles.cache.get(t.roleId)?.name || 'Unknown Role',
                    value: t.roleId,
                    emoji: t.emoji || undefined,
                    description: t.description?.substring(0, 100) || undefined,
                    default: hasRole
                  };
                })
              );

            rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
          }
        }

        await interaction.reply({
          embeds: [embed],
          components: rows,
          flags: MessageFlags.Ephemeral
        });

        const response = await interaction.fetchReply();

        const collector = response.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 300000
        });

        collector.on('collect', async (i: StringSelectMenuInteraction) => {
          const member = await interaction.guild!.members.fetch(i.user.id);
          const category = i.customId.replace('tag_role_', '').replace(/_/g, ' ');
          const categoryTags = categories.get(
            Array.from(categories.keys()).find(k => k.toLowerCase() === category) || ''
          ) || [];

          const selectedRoles = i.values;

          for (const tag of categoryTags) {
            const hasRole = member.roles.cache.has(tag.roleId);
            const shouldHave = selectedRoles.includes(tag.roleId);

            if (hasRole && !shouldHave) {
              await member.roles.remove(tag.roleId).catch(suppress('tags'));
            } else if (!hasRole && shouldHave) {
              const role = interaction.guild!.roles.cache.get(tag.roleId);
              if (role && getDangerousRolePermissions(role.permissions).length > 0) continue;
              await member.roles.add(tag.roleId).catch(suppress('tags'));
            }
          }

          await i.update({
            content: '✅ Roles updated!',
            components: rows
          });
        });

        break;
      }

      case 'add': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You need Manage Roles permission.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const role = interaction.options.getRole('role', true);
        const category = interaction.options.getString('category', true);
        const emoji = interaction.options.getString('emoji');
        const description = interaction.options.getString('description');

        const existing = await TagRole.findOne({ guildId, roleId: role.id });
        if (existing) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This role is already a tag role.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const me = interaction.guild!.members.me;
        if (me && role.position >= me.roles.highest.position) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', `${role} is positioned above my highest role - I can't manage it.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const dangerous = getDangerousRolePermissions(role.permissions as any);
        if (dangerous.length > 0) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', `${role} has sensitive permissions (${dangerous.join(', ')}) and cannot be made self-assignable.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await TagRole.create({
          guildId,
          roleId: role.id,
          category,
          emoji,
          description
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Tag Role Added',
              `**Role:** ${role}\n**Category:** ${category}\n**Emoji:** ${emoji || 'None'}`
            )
          ]
        });
        break;
      }

      case 'remove': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You need Manage Roles permission.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const role = interaction.options.getRole('role', true);
        const result = await TagRole.findOneAndDelete({ guildId, roleId: role.id });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'This role is not a tag role.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Removed', `${role} is no longer a tag role.`)]
        });
        break;
      }

      case 'list': {
        const tags = await TagRole.find({ guildId });

        if (tags.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Tag Roles', 'No tag roles configured.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const categories = new Map<string, typeof tags>();
        for (const tag of tags) {
          if (!categories.has(tag.category)) {
            categories.set(tag.category, []);
          }
          categories.get(tag.category)!.push(tag);
        }

        const embed = new EmbedBuilder()
          .setTitle('🏷️ Tag Roles')
          .setColor(config.bot.embedColor as `#${string}`)
          .setTimestamp();

        for (const [category, categoryTags] of categories) {
          embed.addFields({
            name: category,
            value: categoryTags.map(t => {
              const role = interaction.guild!.roles.cache.get(t.roleId);
              const memberCount = role?.members.size || 0;
              return `${t.emoji || '•'} <@&${t.roleId}> (${memberCount} members)`;
            }).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'text': {
        const settings = await GuildSettings.findOne({ guildId });
        const textTags: Array<{ name?: string; content?: string }> =
          Array.isArray((settings as any)?.tags) ? (settings as any).tags : [];

        const usable = textTags.filter(t => t?.name && t?.content);

        if (usable.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Text tags', 'No text tags have been set in the dashboard yet.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const wanted = interaction.options.getString('nazov');

        if (!wanted) {
          await interaction.reply({
            embeds: [
              EmbedHelper.info(
                'Text tags',
                usable.map(t => `• \`${t.name}\``).join('\n')
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const found = usable.find(t => t.name!.toLowerCase() === wanted.toLowerCase());

        if (!found) {
          await interaction.reply({
            embeds: [EmbedHelper.warning('Unknown tag', `No text tag named \`${wanted}\`.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🏷️ ${found.name}`)
              .setDescription(found.content!)
              .setColor(config.bot.embedColor as `#${string}`)
          ]
        });
        break;
      }
    }
  }
};

export default command;
