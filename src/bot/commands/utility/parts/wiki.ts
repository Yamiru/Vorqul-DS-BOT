/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { WikiPage } from '../../../../utils/models.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Server knowledge base')
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all wiki pages')
    )
    .addSubcommand(sub =>
      sub
        .setName('read')
        .setDescription('Read a wiki page')
        .addStringOption(opt =>
          opt.setName('slug').setDescription('Page slug/name').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a wiki page (Mod)')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Page title').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('content').setDescription('Page content (markdown supported)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('category').setDescription('Category').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit a wiki page (Mod)')
        .addStringOption(opt =>
          opt.setName('slug').setDescription('Page slug').setRequired(true).setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt.setName('content').setDescription('New content').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a wiki page (Admin)')
        .addStringOption(opt =>
          opt.setName('slug').setDescription('Page slug').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('search').setDescription('Search wiki')
        .addStringOption(opt =>
          opt.setName('query').setDescription('Search query').setRequired(true)
        )
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case 'list': {
        const pages = await WikiPage.find({ guildId }, { sort: { category: 1, title: 1 } });

        if (pages.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Server Wiki', 'No wiki pages yet. Moderators can create them with `/wiki create`.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const categories = new Map<string, typeof pages>();
        for (const page of pages) {
          const cat = page.category || 'General';
          if (!categories.has(cat)) {
            categories.set(cat, []);
          }
          categories.get(cat)!.push(page);
        }

        const embed = new EmbedBuilder()
          .setTitle('📚 Server Wiki')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription('Available knowledge base articles')
          .setTimestamp();

        for (const [category, categoryPages] of categories) {
          embed.addFields({
            name: `📁 ${category}`,
            value: categoryPages.map((p: any) => `• \`${p.slug}\` - ${p.title}`).join('\n'),
            inline: false
          });
        }

        embed.setFooter({ text: 'Use /wiki read <slug> to view a page' });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'read': {
        const slug = interaction.options.getString('slug', true).toLowerCase();
        const page = await WikiPage.findOne({ guildId, slug });

        if (!page) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Not Found', 'Wiki page not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        page.views++;
        await page.save();

        const embed = new EmbedBuilder()
          .setTitle(`📖 ${page.title}`)
          .setDescription(page.content.substring(0, 4000))
          .setColor(config.bot.embedColor as `#${string}`)
          .setFooter({
            text: `Category: ${page.category} • Views: ${page.views} • Last edited by ${page.lastEditedBy || page.createdBy}`
          })
          .setTimestamp(page.updatedAt);

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'create': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: 'You need Manage Messages permission.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const title = interaction.options.getString('title', true);
        const content = interaction.options.getString('content', true);
        const category = interaction.options.getString('category') || 'General';

        const slug = title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const existing = await WikiPage.findOne({ guildId, slug });
        if (existing) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'A page with this name already exists.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await WikiPage.create({
          guildId,
          slug,
          title,
          content,
          category,
          createdBy: interaction.user.id,
          views: 0
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Wiki Page Created',
              `**Title:** ${title}\n**Slug:** \`${slug}\`\n**Category:** ${category}\n\nView it with \`/wiki read ${slug}\``
            )
          ]
        });
        break;
      }

      case 'edit': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: 'You need Manage Messages permission.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const slug = interaction.options.getString('slug', true).toLowerCase();
        const newContent = interaction.options.getString('content', true);

        const page = await WikiPage.findOne({ guildId, slug });
        if (!page) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Not Found', 'Wiki page not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        page.content = newContent;
        page.lastEditedBy = interaction.user.id;
        await page.save();

        await interaction.reply({
          embeds: [EmbedHelper.success('Updated', `Wiki page **${page.title}** has been updated.`)]
        });
        break;
      }

      case 'delete': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: 'You need Administrator permission.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const slug = interaction.options.getString('slug', true).toLowerCase();
        const result = await WikiPage.findOneAndDelete({ guildId, slug });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Not Found', 'Wiki page not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Deleted', `Wiki page **${result.title}** has been deleted.`)]
        });
        break;
      }

      case 'search': {
        const query = interaction.options.getString('query', true).toLowerCase();

        const pages = await WikiPage.find({
          guildId,
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } }
          ]
        }, { limit: 10 });

        if (pages.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Search Results', `No pages found for "${query}".`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Search Results: "${query}"`)
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            pages.map((p: any) => `**${p.title}** (\`${p.slug}\`)\n${p.content.substring(0, 100)}...`).join('\n\n')
          )
          .setFooter({ text: `${pages.length} results found` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  }
};

export default command;
