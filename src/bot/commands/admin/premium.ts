/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { getPremiumTier, getLimits, PremiumTier } from '../../../utils/premium.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Manage premium tiers (bot owner only)')
    .setDefaultMemberPermissions(0)
    .addSubcommand(sub =>
      sub.setName('set').setDescription('Grant a premium tier to a server')
        .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
          .addChoices({ name: 'Premium', value: 'premium' }, { name: 'Pro', value: 'pro' }, { name: 'Free (reset)', value: 'free' }))
        .addStringOption(o => o.setName('guild').setDescription('Guild ID (defaults to this server)').setRequired(false))
        .addIntegerOption(o => o.setName('days').setDescription('Expires after this many days (0 = never)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('view').setDescription('Show a server\'s current tier')
        .addStringOption(o => o.setName('guild').setDescription('Guild ID (defaults to this server)').setRequired(false))),

  category: 'admin',
  ownerOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.options.getString('guild') || interaction.guildId!;
    const db = getDatabase();

    if (sub === 'set') {
      const tier = interaction.options.getString('tier', true) as PremiumTier;
      const days = interaction.options.getInteger('days') ?? 0;

      if (tier === 'free') {
        await db.delete('premium_guilds', { guild_id: guildId });
        await interaction.reply({ embeds: [EmbedHelper.success('Premium reset', `Guild \`${guildId}\` is now on the Free tier.`)], flags: MessageFlags.Ephemeral });
        return;
      }

      const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      await db.upsert('premium_guilds', {
        guild_id: guildId, tier, granted_by: interaction.user.id, expires_at, updated_at: new Date().toISOString()
      }, ['guild_id']);

      await interaction.reply({
        embeds: [EmbedHelper.success('Premium granted', `Guild \`${guildId}\` is now **${tier}**${expires_at ? `, expires <t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>` : ' (no expiry)'}.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const tier = await getPremiumTier(guildId);
    const limits = getLimits(tier);
    const lines = Object.entries(limits).map(([k, v]) => `\`${k}\`: ${v}`).join('\n');
    await interaction.reply({
      embeds: [EmbedHelper.info(`Premium: ${tier.toUpperCase()}`, `Guild \`${guildId}\`\n\n**Limits**\n${lines}`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
