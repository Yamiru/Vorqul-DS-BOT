/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, Interaction, TextChannel, EmbedBuilder, MessageFlags } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { getDatabase } from '../../utils/database.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { logger } from '../../utils/logger.js';

const event = {
  name: Events.InteractionCreate,
  execute: async (client: Client, interaction: Interaction) => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'apply_submit' || !interaction.guildId) return;

    try {
      const guildId = interaction.guildId;
      const settings = await GuildSettings.findOne({ guildId });
      const appConfig: any = (settings as any)?.applications || {};

      if (!appConfig.enabled) {
        await interaction.reply({ embeds: [EmbedHelper.error('Applications are off', 'Applications are not enabled on this server.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const db = getDatabase();
      const maxApps = appConfig.maxPerUser || 1;
      const pending = await db.find('applications', { guild_id: guildId, user_id: interaction.user.id, status: 'pending' });
      if (pending.length >= maxApps) {
        await interaction.reply({ embeds: [EmbedHelper.error('Already applied', `You already have ${maxApps} pending application(s). Wait for it to be processed.`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const questions: string[] = Array.isArray(appConfig.questions) && appConfig.questions.length > 0
        ? appConfig.questions.slice(0, 5)
        : ['Why do you want to join the team?'];

      const answers: { question: string; answer: string }[] = [];
      for (let i = 0; i < questions.length; i++) {
        const value = interaction.fields.getTextInputValue(`answer_${i}`);
        if (value !== undefined) answers.push({ question: String(questions[i]), answer: value });
      }

      const id = await db.insert('applications', {
        guild_id: guildId,
        channel_id: appConfig.channel || null,
        user_id: interaction.user.id,
        position: 'Application',
        answers,
        status: 'pending'
      });

      const reviewChannelId = appConfig.reviewChannel || appConfig.channel;
      if (reviewChannelId) {
        const channel = await client.channels.fetch(reviewChannelId).catch(() => null) as TextChannel | null;
        if (channel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle(`📝 New application #${id}`)
            .setColor(0x3498db)
            .setDescription(`From <@${interaction.user.id}> (${interaction.user.tag})`)
            .addFields(answers.slice(0, 25).map((a) => ({
              name: String(a.question).slice(0, 256) || '​',
              value: String(a.answer).slice(0, 1024) || '​'
            })))
            .setFooter({ text: `Review with /apply accept id:${id} or /apply deny id:${id}` })
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch((err) => logger.error('apply:reviewPost failed', err));
        }
      }

      await interaction.reply({ embeds: [EmbedHelper.success('Application sent', `Your application #${id} was submitted for review.`)], flags: MessageFlags.Ephemeral });
    } catch (err) {
      logger.error('applyInteraction error:', err as Error);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [EmbedHelper.error('Error', 'Something went wrong submitting your application.')], flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
        logger.debug('applyInteraction: suppressed error', error);
      }
    }
  }
};

export default event;
