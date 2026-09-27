import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import config from '../../../config/config.json' with { type: 'json' };
import { brand } from '../../../shared/brand.js';
import type { Command } from '../../types.js';
import { suppress } from '../../../utils/suppress.js';

const categoryEmojis: Record<string, string> = {
  moderation: '🛡️',
  utility: '🔧',
  fun: '🎮',
  economy: '💰',
  music: '🎵'
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get info about a specific command')
        .setRequired(false)
    ),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const specificCommand = interaction.options.getString('command');
    const client = interaction.client;

    if (specificCommand) {
      const cmd = client.commands.get(specificCommand);

      if (!cmd) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', 'Command not found.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📖 Command: /${cmd.data.name}`)
        .setDescription(cmd.data.description)
        .setColor(config.bot.embedColor as `#${string}`)
        .addFields(
          { name: 'Category', value: cmd.category, inline: true },
          { name: 'Cooldown', value: `${cmd.cooldown || 0}s`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const categories = new Map<string, Command[]>();

    client.commands.forEach(cmd => {
      const category = cmd.category || 'other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(cmd);
    });

    const mainEmbed = new EmbedBuilder()
      .setTitle('📚 Vorqul DS BOT Help')
      .setDescription(`Select a category from the menu below to view commands.\n\n[Website](${brand.site}) • [GitHub](${brand.repo})`)
      .setColor(config.bot.embedColor as `#${string}`)
      .setThumbnail(client.user?.displayAvatarURL() || '')
      .addFields(
        Array.from(categories.entries()).map(([cat, cmds]) => ({
          name: `${categoryEmojis[cat] || '📁'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
          value: `${cmds.length} commands`,
          inline: true
        }))
      )
      .setFooter({ text: `${client.commands.size} total commands • Made by ${brand.author} • ${brand.footer}` })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category')
      .addOptions(
        Array.from(categories.keys()).map(cat => ({
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          value: cat,
          emoji: categoryEmojis[cat] || '📁'
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'This menu is not for you!', flags: MessageFlags.Ephemeral });
        return;
      }

      const category = i.values[0];
      const commands = categories.get(category) || [];

      const categoryEmbed = new EmbedBuilder()
        .setTitle(`${categoryEmojis[category] || '📁'} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
        .setColor(config.bot.embedColor as `#${string}`)
        .setDescription(
          commands.map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n')
        )
        .setTimestamp();

      await i.update({ embeds: [categoryEmbed] });
    });

    collector.on('end', () => {
      selectMenu.setDisabled(true);
      response.edit({ components: [row] }).catch(suppress('help'));
    });
  }
};

export default command;
