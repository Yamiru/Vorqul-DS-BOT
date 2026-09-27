import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export type DatabaseType = 'mysql' | 'sqlite' | 'json';

interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  storagePath?: string;
}

let dbInstance: DatabaseManager | null = null;

export class DatabaseManager {
  private config: DatabaseConfig;
  private mysqlPool: mysql.Pool | null = null;
  private sqliteDb: any = null;
  private jsonStoragePath: string = '';
  private jsonMtimes: Map<string, number> = new Map();
  private jsonCache: Map<string, any[]> = new Map();

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info(`Inicializujem databázu: ${this.config.type}`);

    switch (this.config.type) {
      case 'mysql':
        await this.initMySQL();
        break;
      case 'sqlite':
        await this.initSQLite();
        break;
      case 'json':
        await this.initJSON();
        break;
    }

    await this.createTables();
    logger.info('Databáza pripravená');
  }

  private async initMySQL(): Promise<void> {
    this.mysqlPool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      user: this.config.user || 'root',
      password: this.config.password || '',
      database: this.config.database || 'vorqul_ds_bot',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    const conn = await this.mysqlPool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('MySQL/MariaDB pripojený');
  }

  private async initSQLite(): Promise<void> {
    logger.warn('SQLite nie je dostupný v tomto prostredí, prepínam na JSON storage');
    this.config.type = 'json';
    await this.initJSON();
  }

  private async initJSON(): Promise<void> {
    this.jsonStoragePath = this.config.storagePath || './data/json';
    if (!fs.existsSync(this.jsonStoragePath)) {
      fs.mkdirSync(this.jsonStoragePath, { recursive: true });
    }

    this.migrateLegacyJsonLocation();

    const files = fs.readdirSync(this.jsonStoragePath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const collection = file.replace('.json', '');
        try {
          const fullPath = path.join(this.jsonStoragePath, file);
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          this.jsonCache.set(collection, data);
          this.jsonMtimes.set(collection, fs.statSync(fullPath).mtimeMs);
        } catch {
          this.jsonCache.set(collection, []);
        }
      }
    }
    logger.info(`JSON Storage: ${this.jsonStoragePath}`);
  }

  private async createTables(): Promise<void> {
    const tables = this.getTableDefinitions();
    for (const sql of Object.values(tables)) {
      if (this.config.type === 'mysql') {
        await this.mysqlPool!.execute(sql.mysql);
      } else if (this.config.type === 'sqlite') {
        this.sqliteDb!.exec(sql.sqlite);
      }
    }
    await this.createIndexes();
  }

  private getIndexDefinitions(): Array<{ table: string; columns: string[] }> {
    return [
      { table: 'user_data', columns: ['guild_id'] },
      { table: 'warnings', columns: ['guild_id', 'user_id'] },
      { table: 'mod_logs', columns: ['guild_id'] },
      { table: 'tickets', columns: ['guild_id', 'status'] },
      { table: 'counters', columns: ['scope', 'guild_id'] },
      { table: 'giveaways', columns: ['guild_id'] },
      { table: 'giveaways', columns: ['ended'] },
      { table: 'reminders', columns: ['user_id'] },
      { table: 'reminders', columns: ['sent'] },
      { table: 'social_feeds', columns: ['guild_id'] },
      { table: 'social_feeds', columns: ['enabled'] },
      { table: 'quests', columns: ['guild_id'] },
      { table: 'user_quests', columns: ['guild_id', 'user_id'] },
      { table: 'tag_roles', columns: ['guild_id'] },
      { table: 'wiki_pages', columns: ['guild_id'] },
      { table: 'referrals', columns: ['guild_id', 'referrer_id'] },
      { table: 'starboard_messages', columns: ['guild_id'] },
      { table: 'scheduled_messages', columns: ['guild_id'] },
      { table: 'scheduled_messages', columns: ['channel_id'] },
      { table: 'polls', columns: ['message_id'] },
      { table: 'polls', columns: ['ended'] },
      { table: 'crypto_alerts', columns: ['triggered'] },
      { table: 'matchmaking_queues', columns: ['guild_id', 'status'] },
      { table: 'activity_streaks', columns: ['guild_id', 'user_id'] },
      { table: 'reputation_logs', columns: ['guild_id', 'to_id'] },
      { table: 'channel_backups', columns: ['guild_id'] },
      { table: 'market_items', columns: ['guild_id'] },
      { table: 'suggestions', columns: ['guild_id', 'status'] },
      { table: 'applications', columns: ['guild_id', 'status'] },
      { table: 'auto_responses', columns: ['guild_id', 'enabled'] },
      { table: 'temp_channels', columns: ['guild_id'] },
      { table: 'temp_channels', columns: ['channel_id'] },
      { table: 'message_stats', columns: ['guild_id', 'user_id'] },
      { table: 'voice_stats', columns: ['guild_id', 'user_id'] },
      { table: 'level_roles', columns: ['guild_id'] },
      { table: 'filter_words', columns: ['guild_id'] },
      { table: 'invites_tracking', columns: ['guild_id', 'inviter_id'] },
      { table: 'game_stats', columns: ['guild_id', 'user_id'] },
      { table: 'afk_status', columns: ['guild_id', 'user_id'] },
      { table: 'persisted_roles', columns: ['guild_id', 'user_id'] },
      { table: 'feature_toggles', columns: ['guild_id'] },
      { table: 'config_snapshots', columns: ['guild_id'] },
      { table: 'suggestion_votes', columns: ['suggestion_id'] },
    ];
  }

  private async createIndexes(): Promise<void> {
    if (this.config.type === 'json') return;

    const tables = this.getTableDefinitions();

    for (const index of this.getIndexDefinitions()) {
      const definition = tables[index.table];
      if (!definition) continue;

      const schema = this.config.type === 'mysql' ? definition.mysql : definition.sqlite;
      const missing = index.columns.filter(
        column => !new RegExp(`^\\s*${column}\\s`, 'm').test(schema)
      );
      if (missing.length > 0) continue;

      const table = this.ident(index.table);
      const columns = index.columns.map(column => this.ident(column));
      const name = this.ident(`idx_${index.table}_${index.columns.join('_')}`);

      try {
        if (this.config.type === 'mysql') {
          const [rows] = await this.mysqlPool!.execute(
            'SELECT 1 FROM information_schema.STATISTICS WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
            [index.table, `idx_${index.table}_${index.columns.join('_')}`]
          );
          if (Array.isArray(rows) && rows.length > 0) continue;
          await this.mysqlPool!.execute(`CREATE INDEX ${name} ON ${table} (${columns.join(', ')})`);
        } else {
          this.sqliteDb!.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columns.join(', ')})`);
        }
      } catch (error: any) {
        if (error?.errno === 1061) continue;
        logger.warn(`Could not create index ${name}: ${error?.message || error}`);
      }
    }
  }

  private getTableDefinitions(): Record<string, { mysql: string; sqlite: string }> {
    return {
      counters: {
        mysql: `CREATE TABLE IF NOT EXISTS counters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          scope VARCHAR(64) NOT NULL,
          guild_id VARCHAR(32) NOT NULL,
          value INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_counter (scope, guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS counters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          value INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(scope, guild_id)
        )`
      },
      guild_settings: {
        mysql: `CREATE TABLE IF NOT EXISTS guild_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL UNIQUE,
          prefix VARCHAR(10) DEFAULT '!',
          language VARCHAR(5) DEFAULT 'en',
          modules JSON,
          welcome_channel VARCHAR(20),
          welcome_message TEXT,
          welcome_embed JSON,
          goodbye_channel VARCHAR(20),
          goodbye_message TEXT,
          log_channels JSON,
          automod JSON,
          antiraid JSON,
          leveling JSON,
          economy JSON,
          starboard JSON,
          suggestions JSON,
          tickets JSON,
          verification JSON,
          custom_commands JSON,
          reaction_roles JSON,
          appeal_info JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_guild_id (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS guild_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL UNIQUE,
          prefix TEXT DEFAULT '!',
          language TEXT DEFAULT 'en',
          modules TEXT,
          welcome_channel TEXT,
          welcome_message TEXT,
          welcome_embed TEXT,
          goodbye_channel TEXT,
          goodbye_message TEXT,
          log_channels TEXT,
          automod TEXT,
          antiraid TEXT,
          leveling TEXT,
          economy TEXT,
          starboard TEXT,
          suggestions TEXT,
          tickets TEXT,
          verification TEXT,
          custom_commands TEXT,
          reaction_roles TEXT,
          appeal_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      config_snapshots: {
        mysql: `CREATE TABLE IF NOT EXISTS config_snapshots (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          label VARCHAR(100) NOT NULL,
          created_by VARCHAR(20) NOT NULL,
          data LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_guild_id (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS config_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          label TEXT NOT NULL,
          created_by TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      suggestion_votes: {
        mysql: `CREATE TABLE IF NOT EXISTS suggestion_votes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          suggestion_id INT NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          vote VARCHAR(4) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_suggestion_vote (suggestion_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS suggestion_votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          suggestion_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          vote TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(suggestion_id, user_id)
        )`
      },
      user_data: {
        mysql: `CREATE TABLE IF NOT EXISTS user_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(20) NOT NULL,
          guild_id VARCHAR(20) NOT NULL,
          xp INT DEFAULT 0,
          level INT DEFAULT 1,
          total_xp INT DEFAULT 0,
          balance INT DEFAULT 0,
          bank INT DEFAULT 0,
          daily_streak INT DEFAULT 0,
          last_daily DATETIME,
          last_work DATETIME,
          last_bank_interest DATETIME,
          inventory JSON,
          loot_boxes JSON,
          reputation INT DEFAULT 0,
          afk_message TEXT,
          afk_since DATETIME,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_guild (user_id, guild_id),
          INDEX idx_guild_xp (guild_id, xp DESC),
          INDEX idx_guild_balance (guild_id, balance DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS user_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          xp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 1,
          total_xp INTEGER DEFAULT 0,
          balance INTEGER DEFAULT 0,
          bank INTEGER DEFAULT 0,
          daily_streak INTEGER DEFAULT 0,
          last_daily DATETIME,
          last_work DATETIME,
          last_bank_interest DATETIME,
          inventory TEXT,
          loot_boxes TEXT,
          reputation INTEGER DEFAULT 0,
          afk_message TEXT,
          afk_since DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, guild_id)
        )`
      },
      warnings: {
        mysql: `CREATE TABLE IF NOT EXISTS warnings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          moderator_id VARCHAR(20) NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_guild_user (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS warnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      giveaways: {
        mysql: `CREATE TABLE IF NOT EXISTS giveaways (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          message_id VARCHAR(20),
          host_id VARCHAR(20) NOT NULL,
          prize TEXT NOT NULL,
          winners_count INT DEFAULT 1,
          ends_at DATETIME NOT NULL,
          ended BOOLEAN DEFAULT FALSE,
          participants JSON,
          winner_ids JSON,
          required_role VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS giveaways (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_id TEXT,
          host_id TEXT NOT NULL,
          prize TEXT NOT NULL,
          winners_count INTEGER DEFAULT 1,
          ends_at DATETIME NOT NULL,
          ended INTEGER DEFAULT 0,
          participants TEXT,
          winner_ids TEXT,
          required_role TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      reminders: {
        mysql: `CREATE TABLE IF NOT EXISTS reminders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          remind_at DATETIME NOT NULL,
          sent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message TEXT NOT NULL,
          remind_at DATETIME NOT NULL,
          sent INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      social_feeds: {
        mysql: `CREATE TABLE IF NOT EXISTS social_feeds (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          platform VARCHAR(20) NOT NULL,
          source_id VARCHAR(255) NOT NULL,
          mention_role VARCHAR(20),
          last_items JSON,
          last_check DATETIME,
          last_item_id VARCHAR(255),
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_feed (guild_id, platform, source_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS social_feeds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          source_id TEXT NOT NULL,
          mention_role TEXT,
          last_items TEXT,
          last_check DATETIME,
          last_item_id TEXT,
          enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, platform, source_id)
        )`
      },
      quests: {
        mysql: `CREATE TABLE IF NOT EXISTS quests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          quest_type VARCHAR(20) NOT NULL,
          quest_id VARCHAR(50) NOT NULL,
          progress INT DEFAULT 0,
          goal INT NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          reward_coins INT DEFAULT 0,
          reward_xp INT DEFAULT 0,
          expires_at DATETIME NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          quest_type TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          progress INTEGER DEFAULT 0,
          goal INTEGER NOT NULL,
          completed INTEGER DEFAULT 0,
          reward_coins INTEGER DEFAULT 0,
          reward_xp INTEGER DEFAULT 0,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      tag_roles: {
        mysql: `CREATE TABLE IF NOT EXISTS tag_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          name VARCHAR(100) NOT NULL,
          role_id VARCHAR(20) NOT NULL,
          description TEXT,
          emoji VARCHAR(50),
          category VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_tag (guild_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS tag_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role_id TEXT NOT NULL,
          description TEXT,
          emoji TEXT,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, name)
        )`
      },
      wiki_pages: {
        mysql: `CREATE TABLE IF NOT EXISTS wiki_pages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          category VARCHAR(100),
          author_id VARCHAR(20) NOT NULL,
          last_edited_by VARCHAR(20),
          views INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_slug (guild_id, slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS wiki_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          slug TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          category TEXT,
          author_id TEXT NOT NULL,
          last_edited_by TEXT,
          views INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, slug)
        )`
      },
      referrals: {
        mysql: `CREATE TABLE IF NOT EXISTS referrals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          referrer_id VARCHAR(20) NOT NULL,
          referred_id VARCHAR(20) NOT NULL,
          code VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_referred (guild_id, referred_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          referrer_id TEXT NOT NULL,
          referred_id TEXT NOT NULL,
          code TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, referred_id)
        )`
      },
      starboard_messages: {
        mysql: `CREATE TABLE IF NOT EXISTS starboard_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          original_message_id VARCHAR(20) NOT NULL,
          starboard_message_id VARCHAR(20),
          channel_id VARCHAR(20) NOT NULL,
          author_id VARCHAR(20) NOT NULL,
          stars INT DEFAULT 0,
          starred_by JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_original (guild_id, original_message_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS starboard_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          original_message_id TEXT NOT NULL,
          starboard_message_id TEXT,
          channel_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          stars INTEGER DEFAULT 0,
          starred_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, original_message_id)
        )`
      },
      scheduled_messages: {
        mysql: `CREATE TABLE IF NOT EXISTS scheduled_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          author_id VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          scheduled_for DATETIME NOT NULL,
          recurring VARCHAR(20) DEFAULT 'none',
          sent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS scheduled_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          content TEXT NOT NULL,
          scheduled_for DATETIME NOT NULL,
          recurring TEXT DEFAULT 'none',
          sent INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      polls: {
        mysql: `CREATE TABLE IF NOT EXISTS polls (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          message_id VARCHAR(20),
          author_id VARCHAR(20) NOT NULL,
          question TEXT NOT NULL,
          options JSON NOT NULL,
          ends_at DATETIME,
          ended BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS polls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_id TEXT,
          author_id TEXT NOT NULL,
          question TEXT NOT NULL,
          options TEXT NOT NULL,
          ends_at DATETIME,
          ended INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      crypto_alerts: {
        mysql: `CREATE TABLE IF NOT EXISTS crypto_alerts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          target_price DECIMAL(20, 8) NOT NULL,
          direction VARCHAR(10) NOT NULL,
          triggered BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS crypto_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          target_price REAL NOT NULL,
          direction TEXT NOT NULL,
          triggered INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      matchmaking_queues: {
        mysql: `CREATE TABLE IF NOT EXISTS matchmaking_queues (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          message_id VARCHAR(20),
          host_id VARCHAR(20) NOT NULL,
          game_name VARCHAR(255) NOT NULL,
          team_size INT DEFAULT 5,
          team_count INT DEFAULT 2,
          players JSON,
          status VARCHAR(20) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS matchmaking_queues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_id TEXT,
          host_id TEXT NOT NULL,
          game_name TEXT NOT NULL,
          team_size INTEGER DEFAULT 5,
          team_count INTEGER DEFAULT 2,
          players TEXT,
          status TEXT DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      activity_streaks: {
        mysql: `CREATE TABLE IF NOT EXISTS activity_streaks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(20) NOT NULL,
          guild_id VARCHAR(20) NOT NULL,
          current_streak INT DEFAULT 0,
          longest_streak INT DEFAULT 0,
          total_active_days INT DEFAULT 0,
          last_active_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_guild (user_id, guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS activity_streaks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          current_streak INTEGER DEFAULT 0,
          longest_streak INTEGER DEFAULT 0,
          total_active_days INTEGER DEFAULT 0,
          last_active_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, guild_id)
        )`
      },
      reputation_logs: {
        mysql: `CREATE TABLE IF NOT EXISTS reputation_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          from_id VARCHAR(20) NOT NULL,
          to_id VARCHAR(20) NOT NULL,
          type VARCHAR(20) NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS reputation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_id TEXT NOT NULL,
          type TEXT NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      channel_backups: {
        mysql: `CREATE TABLE IF NOT EXISTS channel_backups (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL,
          channel_name VARCHAR(255) NOT NULL,
          created_by VARCHAR(20) NOT NULL,
          messages_count INT DEFAULT 0,
          backup_data LONGTEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS channel_backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          channel_name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          messages_count INTEGER DEFAULT 0,
          backup_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      market_items: {
        mysql: `CREATE TABLE IF NOT EXISTS market_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          seller_id VARCHAR(20) NOT NULL,
          item_name VARCHAR(255) NOT NULL,
          item_type VARCHAR(50) NOT NULL,
          price INT NOT NULL,
          quantity INT DEFAULT 1,
          sold BOOLEAN DEFAULT FALSE,
          buyer_id VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sold_at DATETIME
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS market_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          seller_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          item_type TEXT NOT NULL,
          price INTEGER NOT NULL,
          quantity INTEGER DEFAULT 1,
          sold INTEGER DEFAULT 0,
          buyer_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sold_at DATETIME
        )`
      },
      suggestions: {
        mysql: `CREATE TABLE IF NOT EXISTS suggestions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          message_id VARCHAR(20),
          author_id VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          upvotes INT DEFAULT 0,
          downvotes INT DEFAULT 0,
          staff_note TEXT,
          staff_id VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          message_id TEXT,
          author_id TEXT NOT NULL,
          content TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          upvotes INTEGER DEFAULT 0,
          downvotes INTEGER DEFAULT 0,
          staff_note TEXT,
          staff_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      applications: {
        mysql: `CREATE TABLE IF NOT EXISTS applications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20),
          user_id VARCHAR(20) NOT NULL,
          position VARCHAR(100) NOT NULL,
          answers JSON,
          status VARCHAR(20) DEFAULT 'pending',
          reviewer_id VARCHAR(20),
          review_note TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT,
          user_id TEXT NOT NULL,
          position TEXT NOT NULL,
          answers TEXT,
          status TEXT DEFAULT 'pending',
          reviewer_id TEXT,
          review_note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      auto_responses: {
        mysql: `CREATE TABLE IF NOT EXISTS auto_responses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          trigger_text VARCHAR(255) NOT NULL,
          response TEXT NOT NULL,
          use_regex BOOLEAN DEFAULT FALSE,
          delete_trigger BOOLEAN DEFAULT FALSE,
          enabled BOOLEAN DEFAULT TRUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS auto_responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          trigger_text TEXT NOT NULL,
          response TEXT NOT NULL,
          use_regex INTEGER DEFAULT 0,
          delete_trigger INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1
        )`
      },
      temp_channels: {
        mysql: `CREATE TABLE IF NOT EXISTS temp_channels (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          channel_id VARCHAR(20) NOT NULL UNIQUE,
          owner_id VARCHAR(20) NOT NULL,
          is_private BOOLEAN DEFAULT FALSE,
          allowed_users JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS temp_channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL UNIQUE,
          owner_id TEXT NOT NULL,
          is_private INTEGER DEFAULT 0,
          allowed_users TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      message_stats: {
        mysql: `CREATE TABLE IF NOT EXISTS message_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          message_count INT DEFAULT 0,
          UNIQUE KEY unique_user (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS message_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          message_count INTEGER DEFAULT 0,
          UNIQUE(guild_id, user_id)
        )`
      },
      voice_stats: {
        mysql: `CREATE TABLE IF NOT EXISTS voice_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          total_time INT DEFAULT 0,
          session_start DATETIME,
          UNIQUE KEY unique_user (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS voice_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          total_time INTEGER DEFAULT 0,
          session_start DATETIME,
          UNIQUE(guild_id, user_id)
        )`
      },
      mod_logs: {
        mysql: `CREATE TABLE IF NOT EXISTS mod_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          moderator_id VARCHAR(20) NOT NULL,
          action VARCHAR(50) NOT NULL,
          reason TEXT,
          duration INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS mod_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT,
          duration INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      level_roles: {
        mysql: `CREATE TABLE IF NOT EXISTS level_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          level INT NOT NULL,
          role_id VARCHAR(20) NOT NULL,
          remove_previous BOOLEAN DEFAULT FALSE,
          UNIQUE KEY unique_level (guild_id, level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS level_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          level INTEGER NOT NULL,
          role_id TEXT NOT NULL,
          remove_previous INTEGER DEFAULT 0,
          UNIQUE(guild_id, level)
        )`
      },
      filter_words: {
        mysql: `CREATE TABLE IF NOT EXISTS filter_words (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          word VARCHAR(255) NOT NULL,
          UNIQUE KEY unique_word (guild_id, word)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS filter_words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          word TEXT NOT NULL,
          UNIQUE(guild_id, word)
        )`
      },
      invites_tracking: {
        mysql: `CREATE TABLE IF NOT EXISTS invites_tracking (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          inviter_id VARCHAR(20) NOT NULL,
          invited_id VARCHAR(20) NOT NULL,
          bonus_invites INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_invite (guild_id, invited_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS invites_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          inviter_id TEXT NOT NULL,
          invited_id TEXT NOT NULL,
          bonus_invites INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, invited_id)
        )`
      },
      game_stats: {
        mysql: `CREATE TABLE IF NOT EXISTS game_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          game_type VARCHAR(50) NOT NULL,
          wins INT DEFAULT 0,
          losses INT DEFAULT 0,
          ties INT DEFAULT 0,
          UNIQUE KEY unique_game (guild_id, user_id, game_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS game_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          game_type TEXT NOT NULL,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          ties INTEGER DEFAULT 0,
          UNIQUE(guild_id, user_id, game_type)
        )`
      },
      afk_status: {
        mysql: `CREATE TABLE IF NOT EXISTS afk_status (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_afk (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS afk_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, user_id)
        )`
      },
      user_quests: {
        mysql: `CREATE TABLE IF NOT EXISTS user_quests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          quest_id INT NOT NULL,
          progress INT DEFAULT 0,
          completed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_quest (guild_id, user_id, quest_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS user_quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          quest_id INTEGER NOT NULL,
          progress INTEGER DEFAULT 0,
          completed INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, user_id, quest_id)
        )`
      },
      tickets: {
        mysql: `CREATE TABLE IF NOT EXISTS tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          channel_id VARCHAR(32) NOT NULL UNIQUE,
          ticket_number INT NOT NULL,
          status VARCHAR(20) DEFAULT 'open',
          claimed_by VARCHAR(32),
          closed_by VARCHAR(32),
          closed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_guild_user (guild_id, user_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          channel_id TEXT NOT NULL UNIQUE,
          ticket_number INTEGER NOT NULL,
          status TEXT DEFAULT 'open',
          claimed_by TEXT,
          closed_by TEXT,
          closed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      name_history: {
        mysql: `CREATE TABLE IF NOT EXISTS name_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL DEFAULT 'global',
          user_id VARCHAR(32) NOT NULL,
          type VARCHAR(16) NOT NULL,
          value TEXT,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name_user (guild_id, user_id),
          INDEX idx_name_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS name_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL DEFAULT 'global',
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          value TEXT,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      persisted_roles: {
        mysql: `CREATE TABLE IF NOT EXISTS persisted_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          roles JSON,
          nickname VARCHAR(64),
          saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_persist (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS persisted_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          roles TEXT,
          nickname TEXT,
          saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, user_id)
        )`
      },
      feature_toggles: {
        mysql: `CREATE TABLE IF NOT EXISTS feature_toggles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL,
          feature VARCHAR(48) NOT NULL,
          enabled BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_feature (guild_id, feature)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        sqlite: `CREATE TABLE IF NOT EXISTS feature_toggles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          feature TEXT NOT NULL,
          enabled INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, feature)
        )`
      }
    };
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.config.type === 'mysql') {
      const [rows] = await this.mysqlPool!.execute(sql, params);
      return rows as T[];
    } else if (this.config.type === 'sqlite') {
      const stmt = this.sqliteDb!.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params) as T[];
      } else {
        stmt.run(...params);
        return [];
      }
    }
    return [];
  }

  private ident(name: string): string {
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid SQL identifier: ${name}`);
    }
    return name;
  }

  private orderByClause(orderBy: string): string {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(ASC|DESC))?$/i.exec(orderBy.trim());
    if (!m) throw new Error(`Invalid orderBy: ${orderBy}`);
    return m[2] ? `${m[1]} ${m[2].toUpperCase()}` : m[1];
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    if (this.config.type === 'json') {
      return this.jsonInsert(table, data);
    }

    this.ident(table);
    const columns = Object.keys(data).map(c => this.ident(c));
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    if (this.config.type === 'mysql') {
      const [result] = await this.mysqlPool!.execute(sql, values);
      return (result as any).insertId;
    } else {
      const stmt = this.sqliteDb!.prepare(sql);
      const result = stmt.run(...values);
      return result.lastInsertRowid as number;
    }
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    if (this.config.type === 'json') {
      return this.jsonUpdate(table, data, where);
    }

    this.ident(table);
    const setClauses = Object.keys(data).map(k => `${this.ident(k)} = ?`).join(', ');
    const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
    const values = [
      ...Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v),
      ...Object.values(where)
    ];
    const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`;

    if (this.config.type === 'mysql') {
      const [result] = await this.mysqlPool!.execute(sql, values);
      return (result as any).affectedRows;
    } else {
      const stmt = this.sqliteDb!.prepare(sql);
      const result = stmt.run(...values);
      return result.changes;
    }
  }

  async findOne<T = any>(table: string, where: Record<string, any>): Promise<T | null> {
    if (this.config.type === 'json') {
      return this.jsonFindOne(table, where);
    }

    this.ident(table);
    const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
    const sql = `SELECT * FROM ${table} WHERE ${whereClauses} LIMIT 1`;
    const results = await this.query<T>(sql, Object.values(where));

    if (results.length === 0) return null;
    return this.parseJsonFields(results[0]);
  }

  async find<T = any>(
    table: string,
    where: Record<string, any> = {},
    options: { orderBy?: string; limit?: number; offset?: number } = {}
  ): Promise<T[]> {
    if (this.config.type === 'json') {
      return this.jsonFind(table, where, options);
    }

    this.ident(table);
    let sql = `SELECT * FROM ${table}`;
    const values: any[] = [];

    if (Object.keys(where).length > 0) {
      const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
      sql += ` WHERE ${whereClauses}`;
      values.push(...Object.values(where));
    }

    if (options.orderBy) sql += ` ORDER BY ${this.orderByClause(options.orderBy)}`;
    if (options.limit) sql += ` LIMIT ${Number(options.limit) || 0}`;
    if (options.offset) sql += ` OFFSET ${Number(options.offset) || 0}`;

    const results = await this.query<T>(sql, values);
    return results.map(r => this.parseJsonFields(r));
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    if (this.config.type === 'json') {
      return this.jsonDelete(table, where);
    }

    this.ident(table);
    const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereClauses}`;

    if (this.config.type === 'mysql') {
      const [result] = await this.mysqlPool!.execute(sql, Object.values(where));
      return (result as any).affectedRows;
    } else {
      const stmt = this.sqliteDb!.prepare(sql);
      const result = stmt.run(...Object.values(where));
      return result.changes;
    }
  }

  async increment(
    table: string,
    increments: Record<string, number>,
    where: Record<string, any>,
    alsoSet: Record<string, any> = {}
  ): Promise<number> {
    const keys = Object.keys(increments);
    if (keys.length === 0) return this.update(table, alsoSet, where);

    if (this.config.type === 'json') {
      const collection = this.getJsonCollection(table);
      let updated = 0;
      for (let i = 0; i < collection.length; i++) {
        if (!this.matchesWhere(collection[i], where)) continue;
        const row: any = { ...collection[i], ...alsoSet };
        for (const key of keys) {
          row[key] = (Number(row[key]) || 0) + increments[key];
        }
        row.updated_at = new Date().toISOString();
        collection[i] = row;
        updated++;
      }
      if (updated > 0) this.saveJsonCollection(table);
      return updated;
    }

    this.ident(table);
    const clauses: string[] = [];
    const values: any[] = [];

    for (const key of keys) {
      const column = this.ident(key);
      clauses.push(`${column} = COALESCE(${column}, 0) + ?`);
      values.push(increments[key]);
    }
    for (const [key, value] of Object.entries(alsoSet)) {
      clauses.push(`${this.ident(key)} = ?`);
      values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    }

    const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
    values.push(...Object.values(where));

    const sql = `UPDATE ${table} SET ${clauses.join(', ')} WHERE ${whereClauses}`;

    if (this.config.type === 'mysql') {
      const [result] = await this.mysqlPool!.execute(sql, values);
      return (result as any).affectedRows || 0;
    }

    return this.sqliteDb!.prepare(sql).run(...values).changes;
  }

  async nextCounterValue(scope: string, guildId: string, seed = 0): Promise<number> {
    if (this.config.type === 'json') {
      const collection = this.getJsonCollection('counters');
      let row = collection.find((r: any) => r.scope === scope && r.guild_id === guildId);

      if (!row) {
        row = { id: Date.now(), scope, guild_id: guildId, value: seed };
        collection.push(row);
      } else if (row.value < seed) {
        row.value = seed;
      }

      row.value = (Number(row.value) || 0) + 1;
      row.updated_at = new Date().toISOString();
      this.saveJsonCollection('counters');
      return row.value;
    }

    if (this.config.type === 'mysql') {
      await this.mysqlPool!.execute(
        'INSERT INTO counters (scope, guild_id, value) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE value = GREATEST(value, VALUES(value)) + 1',
        [scope, guildId, seed + 1]
      );
      const [rows] = await this.mysqlPool!.execute(
        'SELECT value FROM counters WHERE scope = ? AND guild_id = ?',
        [scope, guildId]
      );
      const list = rows as any[];
      return list.length > 0 ? Number(list[0].value) : seed + 1;
    }

    const result = this.sqliteDb!.prepare(
      'INSERT INTO counters (scope, guild_id, value) VALUES (?, ?, ?) ' +
      'ON CONFLICT(scope, guild_id) DO UPDATE SET value = MAX(counters.value, excluded.value - 1) + 1 ' +
      'RETURNING value'
    ).get(scope, guildId, seed + 1);

    return Number(result.value);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.config.type === 'mysql') {
      const conn = await this.mysqlPool!.getConnection();
      try {
        await conn.beginTransaction();
        const result = await work();
        await conn.commit();
        return result;
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }

    if (this.config.type === 'sqlite') {
      this.sqliteDb!.exec('BEGIN');
      try {
        const result = await work();
        this.sqliteDb!.exec('COMMIT');
        return result;
      } catch (error) {
        this.sqliteDb!.exec('ROLLBACK');
        throw error;
      }
    }

    return work();
  }

  async decrementIfAtLeast(
    table: string,
    column: string,
    amount: number,
    where: Record<string, any>
  ): Promise<boolean> {
    if (this.config.type === 'json') {
      const collection = this.getJsonCollection(table);
      for (let i = 0; i < collection.length; i++) {
        if (!this.matchesWhere(collection[i], where)) continue;
        const current = Number(collection[i][column]) || 0;
        if (current < amount) return false;
        collection[i] = {
          ...collection[i],
          [column]: current - amount,
          updated_at: new Date().toISOString()
        };
        this.saveJsonCollection(table);
        return true;
      }
      return false;
    }

    this.ident(table);
    const col = this.ident(column);
    const whereClauses = Object.keys(where).map(k => `${this.ident(k)} = ?`).join(' AND ');
    const sql = `UPDATE ${table} SET ${col} = ${col} - ? WHERE ${whereClauses} AND ${col} >= ?`;
    const values = [amount, ...Object.values(where), amount];

    if (this.config.type === 'mysql') {
      const [result] = await this.mysqlPool!.execute(sql, values);
      return ((result as any).affectedRows || 0) > 0;
    }

    return this.sqliteDb!.prepare(sql).run(...values).changes > 0;
  }

  async upsert(table: string, data: Record<string, any>, uniqueKeys: string[]): Promise<number> {
    const where: Record<string, any> = {};
    for (const key of uniqueKeys) {
      where[key] = data[key];
    }

    const existing = await this.findOne(table, where);
    if (existing) {
      return this.update(table, data, where);
    } else {
      return this.insert(table, data);
    }
  }

  private jsonInsert(table: string, data: Record<string, any>): number {
    const collection = this.getJsonCollection(table);
    const id = collection.length > 0 ? Math.max(...collection.map(r => r.id || 0)) + 1 : 1;
    collection.push({ id, ...data, created_at: new Date().toISOString() });
    this.saveJsonCollection(table);
    return id;
  }

  private jsonUpdate(table: string, data: Record<string, any>, where: Record<string, any>): number {
    const collection = this.getJsonCollection(table);
    let updated = 0;
    for (let i = 0; i < collection.length; i++) {
      if (this.matchesWhere(collection[i], where)) {
        collection[i] = { ...collection[i], ...data, updated_at: new Date().toISOString() };
        updated++;
      }
    }
    if (updated > 0) this.saveJsonCollection(table);
    return updated;
  }

  private jsonFindOne<T>(table: string, where: Record<string, any>): T | null {
    const collection = this.getJsonCollection(table);
    return collection.find(r => this.matchesWhere(r, where)) || null;
  }

  private jsonFind<T>(
    table: string,
    where: Record<string, any>,
    options: { orderBy?: string; limit?: number; offset?: number }
  ): T[] {
    let collection = this.getJsonCollection(table);

    if (Object.keys(where).length > 0) {
      collection = collection.filter(r => this.matchesWhere(r, where));
    }

    if (options.orderBy) {
      const [field, dir] = options.orderBy.split(' ');
      collection.sort((a, b) => dir?.toUpperCase() === 'DESC' ? b[field] - a[field] : a[field] - b[field]);
    }

    if (options.offset) collection = collection.slice(options.offset);
    if (options.limit) collection = collection.slice(0, options.limit);

    return collection as T[];
  }

  private jsonDelete(table: string, where: Record<string, any>): number {
    const collection = this.getJsonCollection(table);
    const originalLength = collection.length;
    const filtered = collection.filter(r => !this.matchesWhere(r, where));
    this.jsonCache.set(table, filtered);
    this.saveJsonCollection(table);
    return originalLength - filtered.length;
  }

  private migrateLegacyJsonLocation(): void {
    try {
      const legacyDir = path.dirname(this.jsonStoragePath);
      if (path.resolve(legacyDir) === path.resolve(this.jsonStoragePath)) return;
      if (!fs.existsSync(legacyDir)) return;

      const legacyFiles = fs
        .readdirSync(legacyDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name);

      if (legacyFiles.length === 0) return;

      let moved = 0;
      let merged = 0;

      for (const file of legacyFiles) {
        const from = path.join(legacyDir, file);
        const to = path.join(this.jsonStoragePath, file);

        let legacyRecords: any[];
        try {
          legacyRecords = JSON.parse(fs.readFileSync(from, 'utf-8'));
        } catch {
          continue;
        }
        if (!Array.isArray(legacyRecords)) continue;

        if (!fs.existsSync(to)) {
          fs.renameSync(from, to);
          moved++;
          continue;
        }

        let targetRecords: any[];
        try {
          targetRecords = JSON.parse(fs.readFileSync(to, 'utf-8'));
        } catch {
          targetRecords = [];
        }
        if (!Array.isArray(targetRecords)) targetRecords = [];

        const keyOf = (record: any) =>
          record?.guild_id ?? record?.id ?? record?.odId ?? null;

        const byKey = new Map<any, any>();
        for (const record of legacyRecords) {
          const key = keyOf(record);
          if (key !== null) byKey.set(key, record);
        }

        for (const record of targetRecords) {
          const key = keyOf(record);
          if (key === null) continue;
          const legacy = byKey.get(key);

          byKey.set(key, legacy ? { ...legacy, ...record } : record);
        }

        const combined = [...byKey.values()];
        fs.writeFileSync(to, JSON.stringify(combined, null, 2), 'utf-8');
        fs.renameSync(from, `${from}.migrated`);
        merged++;
      }

      if (moved > 0 || merged > 0) {
        logger.warn(
          `JSON dáta presunuté do ${this.jsonStoragePath} ` +
            `(presunutých: ${moved}, zlúčených: ${merged}). ` +
            'Bot a dashboard predtým čítali z rôznych miest.'
        );
      }
    } catch (error) {
      logger.error('Migrácia JSON úložiska zlyhala:', error as Error);
    }
  }

  private getJsonCollection(table: string): any[] {
    const filePath = path.join(this.jsonStoragePath, `${table}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const mtime = fs.statSync(filePath).mtimeMs;
        if (this.jsonMtimes.get(table) !== mtime) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.jsonCache.set(table, Array.isArray(data) ? data : []);
          this.jsonMtimes.set(table, mtime);
        }
      }
    } catch (error) {
        logger.debug('database: suppressed error', error);
      }

    if (!this.jsonCache.has(table)) {
      this.jsonCache.set(table, []);
    }
    return this.jsonCache.get(table)!;
  }

  private saveJsonCollection(table: string): void {
    const collection = this.jsonCache.get(table) || [];
    const filePath = path.join(this.jsonStoragePath, `${table}.json`);

    const temp = `${filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(collection, null, 2), 'utf-8');
    fs.renameSync(temp, filePath);

    try {
      this.jsonMtimes.set(table, fs.statSync(filePath).mtimeMs);
    } catch {
      this.jsonMtimes.delete(table);
    }
  }

  private matchesWhere(record: any, where: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (record[key] !== value) return false;
    }
    return true;
  }

  private parseJsonFields<T>(record: T): T {
    if (!record || typeof record !== 'object') return record;

    const jsonFields = [
      'modules', 'welcome_embed', 'log_channels', 'automod', 'antiraid',
      'leveling', 'economy', 'starboard', 'suggestions', 'tickets',
      'verification', 'custom_commands', 'reaction_roles', 'appeal_info',
      'inventory', 'loot_boxes', 'participants', 'winner_ids', 'options',
      'players', 'starred_by', 'backup_data', 'last_items', 'data'
    ];

    const parsed = { ...record } as any;
    for (const field of jsonFields) {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch (error) {
            logger.debug('database: suppressed error', error);
          }
      }
    }
    return parsed;
  }

  async close(): Promise<void> {
    if (this.mysqlPool) await this.mysqlPool.end();
    if (this.sqliteDb) this.sqliteDb.close();
    logger.info('Databáza zatvorená');
  }

  getType(): DatabaseType {
    return this.config.type;
  }
}

export function createDatabaseFromEnv(): DatabaseManager {
  const type = (process.env.DATABASE_TYPE || 'sqlite') as DatabaseType;

  return new DatabaseManager({
    type,
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'vorqul_ds_bot',

    storagePath: process.env.DATA_PATH
      ? path.join(process.env.DATA_PATH, 'json')
      : './data/json'
  });
}

export function getDatabase(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = createDatabaseFromEnv();
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<DatabaseManager> {
  const db = getDatabase();
  await db.initialize();
  return db;
}

export default DatabaseManager;
