/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { GuildSettings } from '../../../utils/models.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify yourself on the server')
    .addStringOption(opt =>
      opt.setName('kod')
        .setDescription('Verification code (if required)')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const db = getDatabase();
    const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
    const verifyConfig = settings?.verification || {};

    if (!verifyConfig.enabled) {
      return interaction.reply({
        content: '❌ The verification system is not enabled.',
        flags: MessageFlags.Ephemeral
      });
    }

    const existing = await db.findOne('verifications', {
      guild_id: interaction.guildId,
      user_id: interaction.user.id
    });

    if (existing?.verified) {
      return interaction.reply({
        content: '✅ You are already verified!',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = interaction.member as any;
    const verifiedRole = verifyConfig.verifiedRole;
    const unverifiedRole = verifyConfig.unverifiedRole;

    const verifyType = verifyConfig.type || 'button';

    if (verifyType === 'code') {
      const inputCode = interaction.options.getString('kod');

      if (!existing?.code) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        await db.upsert('verifications', {
          guild_id: interaction.guildId,
          user_id: interaction.user.id,
          code: code,
          verified: false
        }, ['guild_id', 'user_id']);

        try {
          await interaction.user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🔐 Verification code')
                .setDescription(`Your verification code for **${interaction.guild?.name}** je:\n\n\`\`\`${code}\`\`\``)
                .setColor(0x3498DB)
                .setFooter({ text: 'Use /verify kod:<code> on the server' })
            ]
          });

          return interaction.reply({
            content: '📧 The verification code has been sent to your DM!',
            flags: MessageFlags.Ephemeral
          });
        } catch {
          return interaction.reply({
            content: '❌ Could not send a DM. Enable messages from server members.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      if (!inputCode) {
        return interaction.reply({
          content: '❌ Enter the verification code using `/verify kod:<code>`',
          flags: MessageFlags.Ephemeral
        });
      }

      if (inputCode.toUpperCase() !== existing.code) {
        return interaction.reply({
          content: '❌ Wrong code! Try again.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    try {
      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }

      if (unverifiedRole) {
        await member.roles.remove(unverifiedRole);
      }

      await db.upsert('verifications', {
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
        verified: true,
        verified_at: new Date().toISOString()
      }, ['guild_id', 'user_id']);

      const embed = new EmbedBuilder()
        .setTitle('✅ Verification successful!')
        .setDescription(`Vitaj na serveri **${interaction.guild?.name}**!`)
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });

      if (verifyConfig.logChannel) {
        const logChannel = interaction.guild?.channels.cache.get(verifyConfig.logChannel);
        if (logChannel?.isTextBased()) {
          await (logChannel as any).send({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ User verified')
                .addFields(
                  { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'ID', value: interaction.user.id, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp()
            ]
          });
        }
      }
    } catch (error) {
      return interaction.reply({
        content: '❌ An error occurred during verification. Contact an administrator.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
