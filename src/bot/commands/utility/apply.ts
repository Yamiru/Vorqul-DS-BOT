/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { GuildSettings } from '../../../utils/models.js';
import { reportError } from '../../../utils/errorReporter.js';
import { logger } from '../../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Application system')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start an application')
    )
    .addSubcommand(sub =>
      sub.setName('accept')
        .setDescription('Accept an application')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('poznamka')
            .setDescription('Note for the applicant')
        )
    )
    .addSubcommand(sub =>
      sub.setName('deny')
        .setDescription('Reject an application')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('dovod')
            .setDescription('Reason for rejection')
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show applications')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Accepted', value: 'accepted' },
              { name: 'Rejected', value: 'denied' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
    const appConfig = settings?.applications || {};

    if (!appConfig.enabled) {
      return interaction.reply({
        content: '❌ The application system is not enabled.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'start') {
      const userApps = await db.find('applications', {
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
        status: 'pending'
      });

      const maxApps = appConfig.maxPerUser || 1;
      if (userApps.length >= maxApps) {
        return interaction.reply({
          content: `❌ You already have ${maxApps} pending application. Wait for it to be processed.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const questions: string[] = Array.isArray(appConfig.questions) && appConfig.questions.length > 0
        ? appConfig.questions.slice(0, 5)
        : ['Why do you want to join the team?'];

      const modal = new ModalBuilder().setCustomId('apply_submit').setTitle('New application');
      for (let i = 0; i < questions.length; i++) {
        const input = new TextInputBuilder()
          .setCustomId(`answer_${i}`)
          .setLabel(String(questions[i]).slice(0, 45) || `Question ${i + 1}`)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      }

      await interaction.showModal(modal);
    }

    if (['accept', 'deny', 'list'].includes(subcommand)) {
      const member = interaction.member as any;
      const reviewerRole = appConfig.reviewerRole;

      const hasPermission = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        (reviewerRole && member.roles.cache.has(reviewerRole));

      if (!hasPermission) {
        return interaction.reply({
          content: '❌ You do not have permission to manage applications.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (subcommand === 'list') {
        const status = interaction.options.getString('status');
        const where: any = { guild_id: interaction.guildId };
        if (status) where.status = status;

        const apps = await db.find('applications', where, { limit: 25 });

        if (apps.length === 0) {
          return interaction.reply({
            content: '📭 No applications.',
            flags: MessageFlags.Ephemeral
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📋 Applications')
          .setColor(0x3498DB)
          .setDescription(
            apps.map((a: any) => {
              const statusEmoji = a.status === 'pending' ? '🟡' :
                                  a.status === 'accepted' ? '✅' : '❌';
              return `${statusEmoji} **#${a.id}** - <@${a.user_id}> → ${a.position}`;
            }).join('\n')
          );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const id = interaction.options.getInteger('id', true);
      const app = await db.findOne('applications', { id, guild_id: interaction.guildId });

      if (!app) {
        return interaction.reply({
          content: '❌ Application not found.',
          flags: MessageFlags.Ephemeral
        });
      }

      const newStatus = subcommand === 'accept' ? 'accepted' : 'denied';
      const note = interaction.options.getString('poznamka') ||
                   interaction.options.getString('dovod');

      await db.update('applications', {
        status: newStatus,
        reviewer_id: interaction.user.id,
        review_note: note
      }, { id });

      try {
        const applicant = await interaction.client.users.fetch(app.user_id);
        await applicant.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(newStatus === 'accepted' ? '🎉 Application accepted!' : '❌ Application rejected')
              .setDescription(`Your application for the position **${app.position}** on server **${interaction.guild?.name}** was ${newStatus === 'accepted' ? 'accepted' : 'rejected'}.`)
              .addFields(note ? [{ name: 'Note', value: note }] : [])
              .setColor(newStatus === 'accepted' ? 0x00FF00 : 0xFF0000)
              .setTimestamp()
          ]
        });
      } catch (error) {
          logger.debug('apply: suppressed error', error);
        }

      if (newStatus === 'accepted' && appConfig.approvedRole) {
        try {
          const member = await interaction.guild?.members.fetch(app.user_id);
          await member?.roles.add(appConfig.approvedRole);
        } catch (error) {
          reportError('apply:addRole', error, { userId: app.user_id, roleId: appConfig.approvedRole });
        }
      }

      await interaction.reply({
        content: `✅ Application #${id} was ${newStatus === 'accepted' ? 'accepted' : 'rejected'}.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
