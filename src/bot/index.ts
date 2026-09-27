/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  Events
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';
import { selectCommandsForRegistration, reportSelection } from './modules/commandRegistry.js';
import { initializeDatabase, getDatabase } from '../utils/database.js';
import { runSettingsMigrations } from '../utils/settingsMigrator.js';
import { reportError, reportFatal } from '../utils/errorReporter.js';
import { loadPlugins, startPluginWatcher, stopPluginWatcher } from './modules/pluginLoader.js';
import type { Command, Plugin } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
    plugins: Collection<string, Plugin>;
  }
}

class VorqulBot {
  public client: Client;
  private token: string;

  constructor() {
    this.token = process.env.DISCORD_TOKEN || '';

    if (!this.token) {
      logger.error('DISCORD_TOKEN is not set in environment variables');
      process.exit(1);
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ]
    });

    this.client.commands = new Collection();
    this.client.cooldowns = new Collection();
    this.client.plugins = new Collection();
  }

  async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const stat = fs.statSync(folderPath);

      if (!stat.isDirectory()) continue;

      const commandFiles = fs.readdirSync(folderPath).filter(file =>
        (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
      );

      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
          const command = await import(pathToFileURL(filePath).href);
          const cmd = command.default || command;

          if ('data' in cmd && 'execute' in cmd) {
            this.client.commands.set(cmd.data.name, cmd);
            logger.debug(`Loaded command: ${cmd.data.name}`);
          } else {
            logger.warn(`Command ${file} is missing required properties`);
          }
        } catch (error) {
          logger.error(`Failed to load command ${file}:`, error as Error);
        }
      }
    }

    logger.info(`Loaded ${this.client.commands.size} commands`);
  }

  async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file =>
      (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
    );

    let loaded = 0;

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      try {
        const event = await import(pathToFileURL(filePath).href);
        const evt: any = event.default || event;

        if (typeof evt === 'function') {
          evt(this.client);
          loaded++;
          logger.debug(`Loaded event (self-registered): ${evt.name || file}`);
          continue;
        }

        if (evt && typeof evt.execute === 'function' && evt.name) {
          const run = (...args: any[]) => {
            try {
              const result = evt.execute(this.client, ...args);
              if (result && typeof result.then === 'function') {
                result.catch((error: unknown) => reportError(`event:${evt.name}`, error));
              }
            } catch (error) {
              reportError(`event:${evt.name}`, error);
            }
          };
          if (evt.once) {
            this.client.once(evt.name, run);
          } else {
            this.client.on(evt.name, run);
          }
          loaded++;
          logger.debug(`Loaded event: ${evt.name}`);
          continue;
        }

        logger.warn(`Skipping event ${file}: neither a function nor a valid { name, execute } object`);
      } catch (error) {
        logger.error(`Failed to load event ${file}:`, error as Error);
      }
    }

    logger.info(`Loaded ${loaded} of ${eventFiles.length} events`);
  }

  async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(this.token);

    try {
      logger.info('Registering slash commands...');

      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) {
        logger.error('DISCORD_CLIENT_ID is not set');
        return;
      }

      const total = this.client.commands.size;
      const selection = selectCommandsForRegistration(this.client.commands);
      reportSelection(selection, total);

      const body = selection.selected.map(cmd => cmd.data.toJSON());
      await rest.put(Routes.applicationCommands(clientId), { body });

      logger.info(`Registered ${body.length} of ${total} slash commands`);
    } catch (error) {
      logger.error('Failed to register commands:', error as Error);
      logger.error(
        'Ak je dôvodom chyba 30032 (limit 100 príkazov), nastav DISABLED_COMMANDS v .env.'
      );
    }
  }

  async start(): Promise<void> {
    try {
      await initializeDatabase();

      runSettingsMigrations();

      await this.loadCommands();
      await this.loadEvents();

      await loadPlugins(this.client);

      this.client.once(Events.ClientReady, () => {
        this.registerCommands().catch((error) => {
          reportError('bot:registerCommands', error);
        });
        startPluginWatcher(this.client, () => this.registerCommands());
      });

      await this.client.login(this.token);
    } catch (error) {
      logger.error('Failed to start bot:', error as Error);
      process.exit(1);
    }
  }
}

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down...');

  const force = setTimeout(() => process.exit(0), 10000);
  force.unref?.();

  stopPluginWatcher();

  try {
    await bot.client.destroy();
  } catch (error) {
    reportError('bot:shutdown:client', error);
  }

  try {
    await getDatabase().close();
  } catch (error) {
    reportError('bot:shutdown:database', error);
  }

  process.exit(0);
}

process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });

process.on('unhandledRejection', (reason) => {
  reportFatal('process:unhandledRejection', reason);
});

process.on('uncaughtException', (error) => {
  reportFatal('process:uncaughtException', error);
  process.exit(1);
});

const bot = new VorqulBot();
bot.start().catch((error) => {
  reportFatal('bot:start', error);
  process.exit(1);
});

export default bot;
