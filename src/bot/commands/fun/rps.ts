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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord.js';

const choices = {
  rock: { emoji: '🪨', name: 'Rock', beats: 'scissors' },
  paper: { emoji: '📄', name: 'Papier', beats: 'rock' },
  scissors: { emoji: '✂️', name: 'Scissors', beats: 'paper' }
};

export default {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors')
    .addUserOption(opt =>
      opt.setName('hrac')
        .setDescription('Opponent (or play against the bot)')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('hrac');

    if (!opponent || opponent.bot) {
      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('rps_rock')
            .setLabel('Rock')
            .setEmoji('🪨')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('rps_paper')
            .setLabel('Papier')
            .setEmoji('📄')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('rps_scissors')
            .setLabel('Scissors')
            .setEmoji('✂️')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎮 Rock, Paper, Scissors')
            .setDescription('Make your choice!')
            .setColor(0x3498DB)
        ],
        components: [buttons]
      });

      const msg = await interaction.fetchReply();

      try {
        const response = await msg.awaitMessageComponent({
          filter: i => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 30000
        });

        const playerChoice = response.customId.replace('rps_', '') as keyof typeof choices;
        const botChoices = Object.keys(choices) as (keyof typeof choices)[];
        const botChoice = botChoices[Math.floor(Math.random() * 3)];

        let result: string;
        let color: number;

        if (playerChoice === botChoice) {
          result = '🤝 Draw!';
          color = 0xFFFF00;
        } else if (choices[playerChoice].beats === botChoice) {
          result = '🎉 Vyhral si!';
          color = 0x00FF00;
        } else {
          result = '😢 Prehral si!';
          color = 0xFF0000;
        }

        await response.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎮 Rock, Paper, Scissors')
              .addFields(
                { name: 'Ty', value: `${choices[playerChoice].emoji} ${choices[playerChoice].name}`, inline: true },
                { name: 'Bot', value: `${choices[botChoice].emoji} ${choices[botChoice].name}`, inline: true }
              )
              .setDescription(result)
              .setColor(color)
          ],
          components: []
        });
      } catch {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏰ Time is up')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
      return;
    }

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot play against yourself!',
        flags: MessageFlags.Ephemeral
      });
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('rps_rock')
          .setLabel('Rock')
          .setEmoji('🪨')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rps_paper')
          .setLabel('Papier')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rps_scissors')
          .setLabel('Scissors')
          .setEmoji('✂️')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      content: `${opponent}, ${interaction.user} challenges you to Rock, Paper, Scissors!`,
      embeds: [
        new EmbedBuilder()
          .setTitle('🎮 Rock, Paper, Scissors')
          .setDescription('Both players must make their choice!')
          .addFields(
            { name: `${interaction.user.username}`, value: '❓ Waiting...', inline: true },
            { name: `${opponent.username}`, value: '❓ Waiting...', inline: true }
          )
          .setColor(0x3498DB)
      ],
      components: [buttons]
    });

    const msg = await interaction.fetchReply();

    const playerChoices: { [key: string]: keyof typeof choices } = {};

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id && i.user.id !== opponent.id) {
        await i.reply({ content: '❌ Toto nie je tvoja hra!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (playerChoices[i.user.id]) {
        await i.reply({ content: '❌ You already picked!', flags: MessageFlags.Ephemeral });
        return;
      }

      const choice = i.customId.replace('rps_', '') as keyof typeof choices;
      playerChoices[i.user.id] = choice;

      await i.reply({ content: `Vybral si: ${choices[choice].emoji}`, flags: MessageFlags.Ephemeral });

      if (playerChoices[interaction.user.id] && playerChoices[opponent.id]) {
        const p1Choice = playerChoices[interaction.user.id];
        const p2Choice = playerChoices[opponent.id];

        let result: string;
        let color: number;

        if (p1Choice === p2Choice) {
          result = '🤝 Draw!';
          color = 0xFFFF00;
        } else if (choices[p1Choice].beats === p2Choice) {
          result = `🎉 ${interaction.user} wins!`;
          color = 0x00FF00;
        } else {
          result = `🎉 ${opponent} wins!`;
          color = 0x00FF00;
        }

        await msg.edit({
          content: null,
          embeds: [
            new EmbedBuilder()
              .setTitle('🎮 Rock, Paper, Scissors - Result')
              .addFields(
                { name: interaction.user.username, value: `${choices[p1Choice].emoji} ${choices[p1Choice].name}`, inline: true },
                { name: opponent.username, value: `${choices[p2Choice].emoji} ${choices[p2Choice].name}`, inline: true }
              )
              .setDescription(result)
              .setColor(color)
          ],
          components: []
        });

        collector.stop();
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await msg.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏰ Time is up')
              .setDescription('Not all players chose in time.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  }
};
