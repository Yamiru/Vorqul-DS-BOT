/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { MatchmakingQueue } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('matchmaking')
    .setDescription('Gaming matchmaking system')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a matchmaking queue')
        .addStringOption(opt =>
          opt.setName('game').setDescription('Game name').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('team_size').setDescription('Players per team').setMinValue(1).setMaxValue(10).setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('teams').setDescription('Number of teams').setMinValue(2).setMaxValue(4).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('join').setDescription('Join the current queue')
    )
    .addSubcommand(sub =>
      sub.setName('leave').setDescription('Leave the current queue')
    )
    .addSubcommand(sub =>
      sub.setName('status').setDescription('View queue status')
    )
    .addSubcommand(sub =>
      sub.setName('start').setDescription('Start matchmaking and create teams')
    )
    .addSubcommand(sub =>
      sub.setName('cancel').setDescription('Cancel the queue')
    ),

  category: 'fun',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    switch (subcommand) {
      case 'create': {
        const game = interaction.options.getString('game', true);
        const teamSize = interaction.options.getInteger('team_size', true);
        const teams = interaction.options.getInteger('teams') || 2;

        const existing = await MatchmakingQueue.findOne({ guildId, status: 'open' });
        if (existing) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'A queue is already active. Cancel it first with `/matchmaking cancel`.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await MatchmakingQueue.create({
          guildId,
          game,
          channelId: interaction.channelId,
          players: [{ odId, joinedAt: new Date(), rank: 'unranked' }],
          teamSize,
          teams,
          status: 'open'
        });

        const totalNeeded = teamSize * teams;

        const embed = new EmbedBuilder()
          .setTitle(`🎮 Matchmaking: ${game}`)
          .setDescription(
            `A new matchmaking queue has been created!\n\n` +
            `**Team Size:** ${teamSize} players\n` +
            `**Teams:** ${teams}\n` +
            `**Total Needed:** ${totalNeeded} players\n\n` +
            `**Players (1/${totalNeeded}):**\n` +
            `• ${interaction.user}`
          )
          .setColor('#5865F2')
          .setFooter({ text: 'Use /matchmaking join to enter!' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('mm_join')
            .setLabel('Join Queue')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('mm_leave')
            .setLabel('Leave')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        break;
      }

      case 'join': {
        const queue = await MatchmakingQueue.findOne({ guildId, status: 'open' });

        if (!queue) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'No active queue. Create one with `/matchmaking create`.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (queue.players.some((p: any) => p.odId === odId)) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You are already in the queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const totalNeeded = queue.teamSize * (queue.teams || 2);
        if (queue.players.length >= totalNeeded) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Queue is full!')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        queue.players.push({ odId, joinedAt: new Date(), rank: 'unranked' });
        await queue.save();

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Joined Queue!',
              `You joined the **${queue.game}** queue.\nPlayers: ${queue.players.length}/${totalNeeded}`
            )
          ]
        });
        break;
      }

      case 'leave': {
        const queue = await MatchmakingQueue.findOne({ guildId, status: 'open' });

        if (!queue) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'No active queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const playerIndex = queue.players.findIndex((p: any) => p.odId === odId);
        if (playerIndex === -1) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'You are not in the queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        queue.players.splice(playerIndex, 1);
        await queue.save();

        await interaction.reply({
          embeds: [EmbedHelper.success('Left Queue', 'You have left the matchmaking queue.')]
        });
        break;
      }

      case 'status': {
        const queue = await MatchmakingQueue.findOne({ guildId, status: 'open' });

        if (!queue) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Matchmaking', 'No active queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const totalNeeded = queue.teamSize * (queue.teams || 2);
        const playerList = queue.players.map((p: any, i: number) => `${i + 1}. <@${p.odId}>`).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`🎮 ${queue.game} Queue`)
          .setDescription(
            `**Players (${queue.players.length}/${totalNeeded}):**\n${playerList || 'None'}\n\n` +
            `**Team Size:** ${queue.teamSize}\n` +
            `**Teams:** ${queue.teams || 2}`
          )
          .setColor('#5865F2')
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'start': {
        const queue = await MatchmakingQueue.findOne({ guildId, status: 'open' });

        if (!queue) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'No active queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const totalNeeded = queue.teamSize * (queue.teams || 2);
        if (queue.players.length < totalNeeded) {
          await interaction.reply({
            embeds: [
              EmbedHelper.warning(
                'Not Enough Players',
                `Need ${totalNeeded} players, but only have ${queue.players.length}.`
              )
            ],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const shuffled = [...queue.players].sort(() => Math.random() - 0.5);
        const teams: string[][] = [];
        const numTeams = queue.teams || 2;

        for (let i = 0; i < numTeams; i++) {
          teams.push([]);
        }

        shuffled.forEach((player, index) => {
          teams[index % numTeams].push(player.odId);
        });

        const teamNames = ['🔴 Red Team', '🔵 Blue Team', '🟢 Green Team', '🟡 Yellow Team'];
        const embed = new EmbedBuilder()
          .setTitle(`🎮 ${queue.game} - Teams Ready!`)
          .setDescription('Good luck and have fun!')
          .setColor('#57F287')
          .setTimestamp();

        teams.forEach((team, i) => {
          embed.addFields({
            name: teamNames[i] || `Team ${i + 1}`,
            value: team.map(id => `<@${id}>`).join('\n'),
            inline: true
          });
        });

        queue.status = 'completed';
        await queue.save();

        const allPlayers = queue.players.map((p: any) => `<@${p.odId}>`).join(' ');

        await interaction.reply({
          content: `🎮 **Teams are ready!** ${allPlayers}`,
          embeds: [embed]
        });
        break;
      }

      case 'cancel': {
        const queue = await MatchmakingQueue.findOne({ guildId, status: 'open' });

        if (!queue) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'No active queue.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        queue.status = 'cancelled';
        await queue.save();

        await interaction.reply({
          embeds: [EmbedHelper.success('Cancelled', `The **${queue.game}** queue has been cancelled.`)]
        });
        break;
      }
    }
  }
};

export default command;
