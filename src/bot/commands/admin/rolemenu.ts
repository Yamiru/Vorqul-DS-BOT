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
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getDangerousRolePermissions } from '../../../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Create a role menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new role menu')
        .addStringOption(opt =>
          opt.setName('title')
            .setDescription('Nadpis menu')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('description')
            .setDescription('Popis menu')
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel for the menu')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(opt =>
          opt.setName('single')
            .setDescription('Allow only one role from the menu')
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role to an existing menu')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('Message ID of the role menu')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Rola na pridanie')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji pre rolu')
        )
        .addStringOption(opt =>
          opt.setName('description')
            .setDescription('Popis roly')
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from the menu')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('Message ID of the role menu')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('button')
        .setDescription('Vytvor button role menu')
        .addStringOption(opt =>
          opt.setName('title')
            .setDescription('Nadpis')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role1')
            .setDescription('Rola 1')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role2')
            .setDescription('Rola 2')
        )
        .addRoleOption(opt =>
          opt.setName('role3')
            .setDescription('Rola 3')
        )
        .addRoleOption(opt =>
          opt.setName('role4')
            .setDescription('Rola 4')
        )
        .addRoleOption(opt =>
          opt.setName('role5')
            .setDescription('Rola 5')
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'create') {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description') || 'Choose a role from the menu below.';
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const singleChoice = interaction.options.getBoolean('single') || false;

      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${title}`)
        .setDescription(description)
        .setColor(0x5865F2)
        .setFooter({ text: singleChoice ? 'You can choose only one role' : 'You can choose multiple roles' });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`rolemenu_${singleChoice ? 'single' : 'multi'}`)
        .setPlaceholder('Vyber rolu...')
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions({
          label: 'No change',
          value: 'none',
          description: 'Zatvor menu bez zmeny',
          emoji: '❌'
        });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const msg = await (channel as any).send({
        embeds: [embed],
        components: [row]
      });

      await db.insert('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: msg.id,
        channel_id: channel!.id,
        emoji: 'select_menu',
        role_id: 'placeholder',
        single_choice: singleChoice
      });

      await interaction.reply({
        content: `✅ Role menu created! Use \`/rolemenu add\` to add roles.\nMessage ID: \`${msg.id}\``,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'add') {
      const messageId = interaction.options.getString('message_id', true);
      const role = interaction.options.getRole('role', true);
      const emoji = interaction.options.getString('emoji') || '🔹';
      const description = interaction.options.getString('description') || `Get the role ${role.name}`;

      const dangerousAdd = getDangerousRolePermissions(role.permissions as any);
      if (dangerousAdd.length > 0) {
        return interaction.reply({
          content: `❌ **${role.name}** has sensitive permissions (${dangerousAdd.join(', ')}) and cannot be offered as a self-assignable role.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const config = await db.findOne('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: messageId
      });

      if (!config) {
        return interaction.reply({
          content: '❌ Role menu not found.',
          flags: MessageFlags.Ephemeral
        });
      }

      try {
        const channel = interaction.guild?.channels.cache.get(config.channel_id);
        if (!channel?.isTextBased()) throw new Error('Channel not found');

        const msg = await (channel as any).messages.fetch(messageId);
        const oldEmbed = msg.embeds[0];
        const oldSelect = msg.components[0]?.components[0];

        if (!oldSelect || oldSelect.type !== 3) {
          throw new Error('Invalid menu');
        }

        const newEmbed = EmbedBuilder.from(oldEmbed)
          .addFields({
            name: `${emoji} ${role.name}`,
            value: description,
            inline: true
          });

        const options = [...oldSelect.options];
        options.push({
          label: role.name,
          value: role.id,
          description: description.substring(0, 100),
          emoji: emoji
        });

        const newSelect = StringSelectMenuBuilder.from(oldSelect as any)
          .setOptions(options)
          .setMaxValues(config.single_choice ? 1 : Math.min(options.length, 25));

        const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newSelect);

        await msg.edit({
          embeds: [newEmbed],
          components: [newRow]
        });

        await db.insert('reaction_roles_config', {
          guild_id: interaction.guildId,
          message_id: messageId,
          channel_id: config.channel_id,
          emoji: emoji,
          role_id: role.id,
          single_choice: config.single_choice
        });

        await interaction.reply({
          content: `✅ Rola ${role} added to the menu!`,
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        await interaction.reply({
          content: '❌ Could not update the menu.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    else if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id', true);
      const role = interaction.options.getRole('role', true);

      const config = await db.findOne('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: messageId,
        role_id: role.id
      });

      await db.delete('reaction_roles_config', {
        guild_id: interaction.guildId,
        message_id: messageId,
        role_id: role.id
      });

      let rebuilt = false;
      if (config) {
        try {
          const channel = interaction.guild?.channels.cache.get(config.channel_id);
          if (channel?.isTextBased()) {
            const msg = await (channel as any).messages.fetch(messageId);
            const oldSelect = msg.components[0]?.components[0];

            if (oldSelect && oldSelect.type === 3) {
              const options = oldSelect.options.filter((o: any) => o.value !== role.id);
              const newSelect = StringSelectMenuBuilder.from(oldSelect as any)
                .setOptions(options)
                .setMaxValues(config.single_choice ? 1 : Math.max(1, Math.min(options.length, 25)));
              const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newSelect);

              const oldEmbed = msg.embeds[0];
              const fieldName = `${config.emoji} ${role.name}`;
              const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
                (oldEmbed?.fields || []).filter((f: any) => f.name !== fieldName)
              );

              await msg.edit({ embeds: [newEmbed], components: [newRow] });
              rebuilt = true;
            }
          }
        } catch (error) {
            logger.debug('rolemenu: suppressed error', error);
          }
      }

      await interaction.reply({
        content: rebuilt
          ? `✅ Rola ${role} removed and the menu has been updated.`
          : `✅ Rola ${role} removed. The menu message could not be updated automatically - edit or recreate it if needed.`,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'button') {
      const title = interaction.options.getString('title', true);
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      if (roles.length === 0) {
        return interaction.reply({
          content: '❌ You must add at least one role!',
          flags: MessageFlags.Ephemeral
        });
      }

      const dangerousRoles = roles.filter(r => getDangerousRolePermissions(r.permissions as any).length > 0);
      if (dangerousRoles.length > 0) {
        return interaction.reply({
          content: `❌ These roles have sensitive permissions and cannot be self-assignable: ${dangerousRoles.map(r => r.name).join(', ')}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${title}`)
        .setDescription(roles.map(r => `• ${r}`).join('\n'))
        .setColor(0x5865F2);

      const buttons = roles.map(role =>
        new ButtonBuilder()
          .setCustomId(`role_${role.id}`)
          .setLabel(role.name)
          .setStyle(ButtonStyle.Primary)
      );

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
      }

      const msg = await (channel as any).send({
        embeds: [embed],
        components: rows
      });

      for (const role of roles) {
        await db.insert('reaction_roles_config', {
          guild_id: interaction.guildId,
          message_id: msg.id,
          channel_id: channel!.id,
          emoji: 'button',
          role_id: role.id,
          single_choice: false
        });
      }

      await interaction.reply({
        content: '✅ Button role menu created!',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
