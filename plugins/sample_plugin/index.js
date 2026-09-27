import { SlashCommandBuilder, Events } from 'discord.js';

let ctx;
let waves = 0;

const waveCommand = {
  data: new SlashCommandBuilder()
    .setName('wave')
    .setDescription('Wave back, and show how many waves this plugin has seen'),

  category: 'plugin',

  execute: async (interaction) => {
    waves++;
    ctx.writeData('waves.json', { waves });

    await interaction.reply({
      embeds: [
        ctx.embed.success(
          'Wave',
          `Hi ${interaction.user}! That is wave number **${waves}**.`
        )
      ]
    });
  }
};

const greetOnKeyword = {
  name: Events.MessageCreate,

  execute: async (client, message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().includes('hello plugin')) return;

    waves++;
    ctx.writeData('waves.json', { waves });
    await message.react('👋');
  }
};

export default {
  name: 'sample_plugin',
  version: '1.0.0',
  author: 'Yamiru',
  description: 'A minimal example plugin',

  commands: [waveCommand],
  events: [greetOnKeyword],

  onLoad: (context) => {
    ctx = context;
    waves = ctx.readData('waves.json', { waves: 0 }).waves;
    ctx.logger.info(`ready, ${waves} waves so far`);
  },

  onUnload: () => {
    ctx.writeData('waves.json', { waves });
    ctx.logger.info('stopped');
  }
};
