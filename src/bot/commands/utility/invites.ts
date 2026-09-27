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
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Manage and view invites')
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check your invites')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User (default: you)')
        )
    )
    .addSubcommand(sub =>
      sub.setName('top')
        .setDescription('Invite leaderboard')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Number to show')
            .setMinValue(5)
            .setMaxValue(25)
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add bonus invites')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Number of invites')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove invites')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Number of invites')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset the invites of a member')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'check') {
      const user = interaction.options.getUser('user') || interaction.user;

      const invitesQuery = `SELECT COUNT(*) as count FROM invites_tracking
                            WHERE guild_id = ? AND inviter_id = ?`;
      const invitesResult = await db.query(invitesQuery, [interaction.guildId, user.id]);
      const realInvites = invitesResult[0]?.count || 0;

      const bonusQuery = `SELECT SUM(bonus_invites) as bonus FROM invites_tracking
                          WHERE guild_id = ? AND inviter_id = ?`;
      const bonusResult = await db.query(bonusQuery, [interaction.guildId, user.id]);
      const bonusInvites = bonusResult[0]?.bonus || 0;

      const totalInvites = realInvites + bonusInvites;

      const embed = new EmbedBuilder()
        .setTitle(`📨 Invites - ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '✅ Real', value: `${realInvites}`, inline: true },
          { name: '🎁 Bonus', value: `${bonusInvites}`, inline: true },
          { name: '📊 Celkom', value: `${totalInvites}`, inline: true }
        )
        .setColor(0x3498DB);

      await interaction.reply({ embeds: [embed] });
    }

    else if (subcommand === 'top') {
      const limit = interaction.options.getInteger('limit') || 10;

      const query = `SELECT inviter_id, COUNT(*) as count,
                     COALESCE(SUM(bonus_invites), 0) as bonus
                     FROM invites_tracking
                     WHERE guild_id = ?
                     GROUP BY inviter_id
                     ORDER BY (COUNT(*) + COALESCE(SUM(bonus_invites), 0)) DESC
                     LIMIT ?`;

      const stats = await db.query(query, [interaction.guildId, limit]);

      if (stats.length === 0) {
        return interaction.reply({
          content: '📭 No invites yet.',
          flags: MessageFlags.Ephemeral
        });
      }

      const lines: string[] = [];
      let position = 1;

      for (const stat of stats) {
        const total = (stat.count || 0) + (stat.bonus || 0);
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;
        lines.push(`${medal} <@${stat.inviter_id}> - **${total}** invites`);
        position++;
      }

      const embed = new EmbedBuilder()
        .setTitle('📨 Top Inviters')
        .setDescription(lines.join('\n'))
        .setColor(0x9B59B6)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    else if (['add', 'remove', 'reset'].includes(subcommand)) {
      const member = interaction.member as any;
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: '❌ You do not have permission for this action.',
          flags: MessageFlags.Ephemeral
        });
      }

      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount') || 0;

      if (subcommand === 'add') {
        await db.insert('invites_tracking', {
          guild_id: interaction.guildId,
          inviter_id: user.id,
          invited_id: 'bonus_' + Date.now(),
          bonus_invites: amount
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Bonus invites added')
              .setDescription(`Added **${amount}** invites for ${user}`)
              .setColor(0x00FF00)
          ]
        });
      }

      else if (subcommand === 'remove') {
        await db.insert('invites_tracking', {
          guild_id: interaction.guildId,
          inviter_id: user.id,
          invited_id: 'penalty_' + Date.now(),
          bonus_invites: -amount
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Invites removed')
              .setDescription(`Removed **${amount}** invites from ${user}`)
              .setColor(0xFF6B6B)
          ]
        });
      }

      else if (subcommand === 'reset') {
        await db.delete('invites_tracking', {
          guild_id: interaction.guildId,
          inviter_id: user.id
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🗑️ Invites reset')
              .setDescription(`All invites for ${user} have been deleted.`)
              .setColor(0xFF6B6B)
          ]
        });
      }
    }
  }
};
