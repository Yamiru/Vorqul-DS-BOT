import {
  Client,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Events
} from 'discord.js';
import type { Plugin, Command, Event } from '../../src/bot/types.js';
import { EmbedHelper } from '../../src/utils/embedHelper.js';
import { logger } from '../../src/utils/logger.js';

const exampleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('plugin-example')
    .setDescription('An example command from a plugin'),

  category: 'plugin',

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          'Plugin Command',
          'This command comes from the sample plugin!'
        )
      ]
    });
  }
};

const exampleEvent: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  execute: async (client: Client, message) => {
    if (message.content.toLowerCase().includes('hello plugin')) {
      try {
        await message.react('👋');
      } catch {
      }
    }
  }
};

const plugin: Plugin = {
  name: 'sample_plugin',
  version: '1.0.0',
  author: 'Yamiru',
  description: 'A sample plugin template for Vorqul DS BOT',

  commands: [exampleCommand],

  events: [exampleEvent],

  onLoad: async (client: Client) => {
    logger.info('Sample plugin loaded!');
  },

  onUnload: async (client: Client) => {
    logger.info('Sample plugin unloaded!');
  }
};

export default plugin;
