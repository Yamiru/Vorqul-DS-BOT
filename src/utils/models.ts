import { getDatabase } from './database.js';
import fs from 'fs';
import path from 'path';
import { toDashboardFormat } from '../shared/settingsSchema.js';
import { resolveEconomy } from '../shared/featureConfig.js';
import { migrateAllRecords, SETTINGS_SCHEMA_VERSION } from '../shared/settingsMigrations.js';

const db = () => getDatabase();

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_STORAGE_PATH = path.join(DATA_DIR, 'json');
const GUILD_SETTINGS_FILE = path.join(JSON_STORAGE_PATH, 'guild_settings.json');

function ensureJsonDir() {
  if (!fs.existsSync(JSON_STORAGE_PATH)) {
    fs.mkdirSync(JSON_STORAGE_PATH, { recursive: true });
  }
}

function loadJsonSettings(): any[] {
  ensureJsonDir();
  if (!fs.existsSync(GUILD_SETTINGS_FILE)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(GUILD_SETTINGS_FILE, 'utf-8'));

    return migrateAllRecords(raw).records;
  } catch {
    return [];
  }
}

function loadJsonSettingsForWrite(): any[] {
  ensureJsonDir();
  if (!fs.existsSync(GUILD_SETTINGS_FILE)) return [];

  const raw = JSON.parse(fs.readFileSync(GUILD_SETTINGS_FILE, 'utf-8'));
  return migrateAllRecords(raw).records;
}

function saveJsonSettings(settings: any[]): void {
  ensureJsonDir();
  const tmp = `${GUILD_SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf-8');
  fs.renameSync(tmp, GUILD_SETTINGS_FILE);
}

export const GuildSettings = {
  async findOne(where: { guildId: string | null }) {
    if (!where.guildId) return null;

    const all = loadJsonSettings();
    const found = all.find(s => s.guild_id === where.guildId);
    if (!found) return null;

    return toDashboardFormat(found);
  },

  async find(_where: Record<string, any> = {}) {
    const all = loadJsonSettings();
    return all.map((r: any) => ({
      ...r,
      guildId: r.guild_id,
      language: r.language || 'en'
    }));
  },

  async findOneAndUpdate(
    where: { guildId: string },
    update: Record<string, any>,
    options?: { upsert?: boolean }
  ) {
    const all = loadJsonSettingsForWrite();
    const index = all.findIndex(s => s.guild_id === where.guildId);

    let data: any = { guild_id: where.guildId };

    if (index >= 0) {
      data = { ...all[index] };
    }

    if (update.$set) {
      Object.assign(data, update.$set);
    }

    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        data[key] = (data[key] || 0) + (val as number);
      }
    }

    data.updated_at = new Date().toISOString();
    data.schema_version = SETTINGS_SCHEMA_VERSION;

    if (index >= 0) {
      all[index] = data;
    } else if (options?.upsert) {
      data.created_at = new Date().toISOString();
      all.push(data);
    }

    saveJsonSettings(all);
    return this.findOne(where);
  },

  async updateOne(
    where: { guildId?: string | null; guild_id?: string },
    update: Record<string, any>,
    options?: { upsert?: boolean }
  ) {
    const guildId = where.guildId || where.guild_id;
    if (!guildId) return;

    return this.findOneAndUpdate(
      { guildId },
      update,
      options
    );
  },

  async create(data: any) {
    const all = loadJsonSettingsForWrite();
    const newSettings = {
      guild_id: data.guildId,
      ...data,
      created_at: new Date().toISOString()
    };
    delete newSettings.guildId;
    all.push(newSettings);
    saveJsonSettings(all);
    return { ...newSettings, guildId: data.guildId };
  }
};

const USER_DATA_ALIASES: Record<string, string> = {
  totalXp: 'total_xp',
  dailyStreak: 'daily_streak',
  lastDaily: 'last_daily',
  lastWork: 'last_work',
  lastBankInterest: 'last_bank_interest',
  lastWheelSpin: 'last_wheel_spin',
  wheelSpins: 'wheel_spins',
  lootBoxes: 'loot_boxes',
  afkMessage: 'afk_message',
  afkSince: 'afk_since',
  odId: 'user_id',
  guildId: 'guild_id',
};

const DATE_FIELDS = new Set(['last_daily', 'last_work', 'last_bank_interest', 'last_wheel_spin', 'afk_since']);

function hydrateUserData(row: any): any {
  if (!row) return row;

  const doc: any = { ...row };

  for (const [camel, column] of Object.entries(USER_DATA_ALIASES)) {
    const value = row[column];
    if (value === undefined || value === null) {
      doc[camel] = DATE_FIELDS.has(column) ? null : doc[camel];
      continue;
    }
    doc[camel] = DATE_FIELDS.has(column) ? new Date(value) : value;
  }

  doc.save = async function save() {
    const data: Record<string, any> = {};

    for (const [camel, column] of Object.entries(USER_DATA_ALIASES)) {
      if (camel === 'odId' || camel === 'guildId') continue;
      const value = this[camel];
      if (value === undefined) continue;
      data[column] = value instanceof Date ? value.toISOString() : value;
    }

    for (const key of ['xp', 'level', 'reputation', 'messages', 'inventory', 'warnings']) {
      if (this[key] !== undefined) data[key] = this[key];
    }

    await db().update('user_data', data, {
      user_id: this.user_id || this.odId,
      guild_id: this.guild_id || this.guildId,
    });

    return this;
  };

  return doc;
}

export const UserData = {
  async findOne(where: { odId?: string; guildId?: string; odId_guildId?: { odId: string; guildId: string } }) {
    if (where.odId_guildId) {
      return hydrateUserData(await db().findOne('user_data', {
        user_id: where.odId_guildId.odId,
        guild_id: where.odId_guildId.guildId
      }));
    }
    if (where.odId && where.guildId) {
      return hydrateUserData(await db().findOne('user_data', {
        user_id: where.odId,
        guild_id: where.guildId
      }));
    }
    if (where.odId) {
      return hydrateUserData(await db().findOne('user_data', { user_id: where.odId }));
    }
    return null;
  },

  async findOneAndUpdate(
    where: { odId: string; guildId: string },
    update: Record<string, any>,
    options?: { upsert?: boolean }
  ) {
    const data: Record<string, any> = {
      user_id: where.odId,
      guild_id: where.guildId
    };

    if (update.$set) Object.assign(data, update.$set);

    delete data.$set;
    delete data.$inc;

    const rowWhere = { user_id: where.odId, guild_id: where.guildId };
    const increments: Record<string, number> = {};

    if (update.$inc) {
      for (const [key, val] of Object.entries(update.$inc)) {
        increments[key] = Number(val) || 0;
      }
    }

    if (Object.keys(increments).length === 0) {
      if (options?.upsert) {
        await db().upsert('user_data', data, ['user_id', 'guild_id']);
      } else {
        await db().update('user_data', data, rowWhere);
      }
      return this.findOne({ odId: where.odId, guildId: where.guildId });
    }

    const existing = await db().findOne('user_data', rowWhere);

    if (!existing) {
      if (!options?.upsert) return null;
      await this.create({ odId: where.odId, guildId: where.guildId });
    }

    const setData = { ...data };
    delete setData.user_id;
    delete setData.guild_id;

    await db().increment('user_data', increments, rowWhere, setData);

    return this.findOne({ odId: where.odId, guildId: where.guildId });
  },

  async transfer(
    guildId: string,
    fromId: string,
    toId: string,
    amount: number
  ): Promise<{ ok: boolean; reason?: 'invalid_amount' | 'insufficient' }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid_amount' };
    }

    if (!(await this.findOne({ odId: fromId, guildId }))) {
      await this.create({ odId: fromId, guildId });
    }
    if (!(await this.findOne({ odId: toId, guildId }))) {
      await this.create({ odId: toId, guildId });
    }

    return db().transaction(async () => {
      const debited = await db().decrementIfAtLeast('user_data', 'balance', amount, {
        user_id: fromId,
        guild_id: guildId
      });

      if (!debited) return { ok: false, reason: 'insufficient' as const };

      await db().increment('user_data', { balance: amount }, {
        user_id: toId,
        guild_id: guildId
      });

      return { ok: true };
    });
  },

  async create(data: { odId: string; guildId: string; [key: string]: any }) {
    let startingBalance = 0;
    if (data.balance === undefined) {
      try {
        const settings = await GuildSettings.findOne({ guildId: data.guildId });
        startingBalance = resolveEconomy(settings).startingBalance;
      } catch {
        startingBalance = 0;
      }
    }

    const insertData: any = {
      user_id: data.odId,
      guild_id: data.guildId,
      xp: data.xp || 0,
      level: data.level || 1,
      balance: data.balance ?? startingBalance,
      ...data
    };
    delete insertData.odId;
    delete insertData.guildId;
    const id = await db().insert('user_data', insertData);
    return hydrateUserData({ id, ...insertData, user_id: data.odId, guild_id: data.guildId });
  },

  async find(where: { guildId: string; [key: string]: any }, options?: { sort?: Record<string, number>; limit?: number }) {
    let orderBy: string | undefined;
    if (options?.sort) {
      const [field, dir] = Object.entries(options.sort)[0];
      const column = USER_DATA_ALIASES[field] || field;
      orderBy = `${column} ${dir === -1 ? 'DESC' : 'ASC'}`;
    }
    const rows = await db().find('user_data', { guild_id: where.guildId }, { orderBy, limit: options?.limit });
    return rows.map((r: any) => hydrateUserData(r));
  },

  async countDocuments(where: { guildId: string; [key: string]: any }) {
    const results = await db().find('user_data', { guild_id: where.guildId });

    return results.filter((r: any) => {
      for (const [key, val] of Object.entries(where)) {
        if (key === 'guildId') continue;
        const column = USER_DATA_ALIASES[key] || key;
        if (val && typeof val === 'object' && '$gt' in val) {
          if (!(r[column] > val.$gt)) return false;
        }
      }
      return true;
    }).length;
  },

  async aggregate(_pipeline: any[]): Promise<any[]> {
    return [];
  },

  async updateOne(
    where: { odId: string; guildId: string },
    update: Record<string, any>
  ) {
    const data: Record<string, any> = {};
    if (update.$set) Object.assign(data, update.$set);
    if (update.$inc) {
      const existing = await this.findOne({ odId: where.odId, guildId: where.guildId });
      for (const [key, val] of Object.entries(update.$inc)) {
        data[key] = (existing?.[key] || 0) + (val as number);
      }
    }
    await db().update('user_data', data, { user_id: where.odId, guild_id: where.guildId });
  }
};

export const Warning = {
  async create(data: { guildId: string; odId: string; moderatorId: string; reason: string }) {
    const id = await db().insert('warnings', {
      guild_id: data.guildId,
      user_id: data.odId,
      moderator_id: data.moderatorId,
      reason: data.reason
    });
    return { id, ...data };
  },

  async find(where: { guildId: string; odId: string }) {
    return db().find('warnings', { guild_id: where.guildId, user_id: where.odId });
  },

  async countDocuments(where: { guildId: string; odId: string }) {
    const results = await this.find(where);
    return results.length;
  },

  async deleteMany(where: { guildId: string; odId: string }) {
    return db().delete('warnings', { guild_id: where.guildId, user_id: where.odId });
  }
};

export const Giveaway = {
  async create(data: any) {
    const id = await db().insert('giveaways', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      message_id: data.messageId,
      host_id: data.hostId,
      prize: data.prize,
      winners_count: data.winnersCount || 1,
      ends_at: data.endsAt,
      participants: data.participants || [],
      required_role: data.requiredRole
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    return db().findOne('giveaways', this.convertWhere(where));
  },

  async find(where: any) {
    return db().find('giveaways', this.convertWhere(where));
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || update;
    await db().update('giveaways', data, this.convertWhere(where));
    return this.findOne(where);
  },

  convertWhere(where: any) {
    const result: any = {};
    if (where.guildId) result.guild_id = where.guildId;
    if (where.messageId) result.message_id = where.messageId;
    if (where.ended !== undefined) result.ended = where.ended ? 1 : 0;
    return result;
  }
};

export const Reminder = {
  async create(data: { odId: string; channelId: string; message: string; remindAt: Date; guildId?: string }) {
    const id = await db().insert('reminders', {
      user_id: data.odId,
      channel_id: data.channelId,
      message: data.message,
      remind_at: data.remindAt.toISOString(),
      guild_id: data.guildId || null
    });
    return { id, _id: id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.odId) converted.user_id = where.odId;
    if (where.sent !== undefined) converted.sent = where.sent ? 1 : 0;
    const results = await db().find('reminders', converted);
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findOneAndUpdate(where: { _id: number }, update: any) {
    const data = update.$set || update;
    await db().update('reminders', data, { id: where._id });
  },

  async findByIdAndDelete(id: number) {
    const existing = await db().findOne('reminders', { id });
    if (existing) {
      await db().delete('reminders', { id });
    }
    return existing;
  },

  async findOneAndDelete(where: { _id?: number | string; odId?: string }) {
    const converted: any = {};
    if (where._id) converted.id = typeof where._id === 'string' ? parseInt(where._id, 10) : where._id;
    if (where.odId) converted.user_id = where.odId;
    const existing = await db().findOne('reminders', converted);
    if (existing) {
      await db().delete('reminders', converted);
    }
    return existing;
  }
};

export const SocialFeed = {
  async create(data: any) {
    const id = await db().insert('social_feeds', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      platform: data.platform ?? data.type,
      source_id: data.sourceId ?? data.sourceUrl,
      mention_role: data.mentionRole ?? null,
      last_items: data.lastItems ?? [],
      enabled: data.enabled === false ? 0 : 1
    });
    return { id, _id: id, ...data };
  },

  async find(where?: any) {
    const converted: any = {};
    if (where?.guildId) converted.guild_id = where.guildId;
    if (where?.platform) converted.platform = where.platform;
    if (where?.enabled !== undefined) converted.enabled = where.enabled ? 1 : 0;
    const results = await db().find('social_feeds', converted);
    return results.map((r: any) => this.hydrate(r));
  },

  hydrate(row: any) {
    if (!row) return row;
    let lastItems = row.last_items;
    if (typeof lastItems === 'string') {
      try { lastItems = JSON.parse(lastItems); } catch { lastItems = []; }
    }
    if (!Array.isArray(lastItems)) lastItems = [];

    const doc: any = {
      ...row,
      _id: row.id,
      type: row.platform,
      sourceId: row.source_id,
      sourceUrl: row.source_id,
      channelId: row.channel_id,
      mentionRole: row.mention_role ?? undefined,
      lastItems,
      enabled: row.enabled !== 0 && row.enabled !== false
    };
    doc.save = async function save() {
      await db().update('social_feeds', {
        enabled: this.enabled ? 1 : 0,
        mention_role: this.mentionRole ?? null,
        last_items: this.lastItems ?? [],
        last_check: this.last_check ?? null,
        last_item_id: this.last_item_id ?? null
      }, { id: this.id });
      return this;
    };
    return doc;
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where._id) converted.id = typeof where._id === 'string' ? parseInt(where._id, 10) : where._id;
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.platform) converted.platform = where.platform;
    if (where.sourceId) converted.source_id = where.sourceId;
    const result = await db().findOne('social_feeds', converted);
    return result ? this.hydrate(result) : null;
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || update;
    const converted: any = {};
    if (where._id) converted.id = typeof where._id === 'string' ? parseInt(where._id, 10) : where._id;
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.platform) converted.platform = where.platform;
    if (where.sourceId) converted.source_id = where.sourceId;
    await db().update('social_feeds', data, converted);
    return this.findOne(where);
  },

  async findOneAndDelete(where: any) {
    const converted: any = {};
    if (where._id) converted.id = typeof where._id === 'string' ? parseInt(where._id, 10) : where._id;
    if (where.guildId) converted.guild_id = where.guildId;
    const existing = await db().findOne('social_feeds', converted);
    if (existing) {
      await db().delete('social_feeds', converted);
    }
    return existing;
  },

  async deleteOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.platform) converted.platform = where.platform;
    if (where.sourceId) converted.source_id = where.sourceId;
    return db().delete('social_feeds', converted);
  }
};

export const Quest = {
  async create(data: any) {
    const id = await db().insert('quests', {
      guild_id: data.guildId,
      user_id: data.odId,
      quest_type: data.questType,
      quest_id: data.questId,
      progress: data.progress || 0,
      goal: data.goal,
      reward_coins: data.rewardCoins,
      reward_xp: data.rewardXp,
      expires_at: data.expiresAt
    });
    return { id, _id: id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.questType) converted.quest_type = where.questType;
    if (where.active !== undefined) converted.active = where.active ? 1 : 0;
    return db().find('quests', converted);
  },

  async findOne(where: any) {
    if (where._id) return db().findOne('quests', { id: where._id });
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    return db().findOne('quests', converted);
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || {};
    if (update.$inc) {
      const existing = await db().findOne('quests', { id: where._id });
      for (const [key, val] of Object.entries(update.$inc)) {
        data[key] = (existing?.[key] || 0) + (val as number);
      }
    }
    await db().update('quests', data, { id: where._id });
    return this.findOne(where);
  },

  async deleteOne(where: any) {
    await db().delete('quests', { id: where._id });
  },

  async deleteMany(where: any) {
    const converted: any = {};
    if (where.odId) converted.user_id = where.odId;
    if (where.guildId) converted.guild_id = where.guildId;
    return db().delete('quests', converted);
  }
};

export const TagRole = {
  async create(data: any) {
    const id = await db().insert('tag_roles', {
      guild_id: data.guildId,
      name: data.name,
      role_id: data.roleId,
      description: data.description,
      emoji: data.emoji,
      category: data.category
    });
    return { id, ...data };
  },

  async find(where: any) {
    return db().find('tag_roles', { guild_id: where.guildId });
  },

  async findOne(where: any) {
    return db().findOne('tag_roles', { guild_id: where.guildId, name: where.name });
  },

  async findOneAndDelete(where: any) {
    const converted: any = { guild_id: where.guildId };
    if (where.roleId) converted.role_id = where.roleId;
    if (where.name) converted.name = where.name;
    const existing = await db().findOne('tag_roles', converted);
    if (existing) {
      await db().delete('tag_roles', converted);
    }
    return existing;
  },

  async deleteOne(where: any) {
    return db().delete('tag_roles', { guild_id: where.guildId, name: where.name });
  }
};

export const WikiPage = {
  async create(data: any) {
    const id = await db().insert('wiki_pages', {
      guild_id: data.guildId,
      slug: data.slug,
      title: data.title,
      content: data.content,
      category: data.category,
      author_id: data.authorId
    });
    return { id, ...data };
  },

  async find(where: any, options?: { sort?: Record<string, number>; limit?: number }) {
    let results = await db().find('wiki_pages', { guild_id: where.guildId });

    if (where.$or) {
      const query = where.$or[0]?.title?.$regex?.toLowerCase() || '';
      results = results.filter((page: any) =>
        page.title?.toLowerCase().includes(query) ||
        page.content?.toLowerCase().includes(query)
      );
    }

    if (options?.sort) {
      const entries = Object.entries(options.sort);
      results.sort((a: any, b: any) => {
        for (const [field, order] of entries) {
          const aVal = a[field] || '';
          const bVal = b[field] || '';
          const cmp = aVal.localeCompare?.(bVal) || 0;
          if (cmp !== 0) return order === 1 ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  },

  async findOne(where: any) {
    return db().findOne('wiki_pages', { guild_id: where.guildId, slug: where.slug });
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || update;
    if (update.$inc?.views) {
      const existing = await this.findOne(where);
      data.views = (existing?.views || 0) + update.$inc.views;
    }
    await db().update('wiki_pages', data, { guild_id: where.guildId, slug: where.slug });
    return this.findOne(where);
  },

  async findOneAndDelete(where: any) {
    const existing = await this.findOne(where);
    if (existing) {
      await db().delete('wiki_pages', { guild_id: where.guildId, slug: where.slug });
    }
    return existing;
  },

  async deleteOne(where: any) {
    return db().delete('wiki_pages', { guild_id: where.guildId, slug: where.slug });
  }
};

export const Referral = {
  async create(data: any) {
    const id = await db().insert('referrals', {
      guild_id: data.guildId,
      referrer_id: data.referrerId,
      referred_id: data.referredId,
      code: data.code
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.code) converted.code = where.code;
    if (where.referredId) converted.referred_id = where.referredId;
    return db().findOne('referrals', converted);
  },

  async find(where: any) {
    return db().find('referrals', { guild_id: where.guildId, referrer_id: where.referrerId });
  },

  async countDocuments(where: any) {
    const results = await this.find(where);
    return results.length;
  },

  async aggregate(_pipeline: any[]): Promise<any[]> {
    const all = await db().find('referrals', {});
    const counts: Record<string, number> = {};
    for (const ref of all) {
      counts[ref.referrer_id] = (counts[ref.referrer_id] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([referrer_id, count]) => ({ _id: referrer_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
};

export const StarboardMessage = {
  async create(data: any) {
    const id = await db().insert('starboard_messages', {
      guild_id: data.guildId,
      original_message_id: data.originalMessageId,
      starboard_message_id: data.starboardMessageId,
      channel_id: data.channelId,
      author_id: data.authorId,
      stars: data.stars || 0,
      starred_by: data.starredBy || []
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    return db().findOne('starboard_messages', {
      guild_id: where.guildId,
      original_message_id: where.originalMessageId
    });
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || update;
    await db().update('starboard_messages', data, {
      guild_id: where.guildId,
      original_message_id: where.originalMessageId
    });
    return this.findOne(where);
  },

  async findOneAndDelete(where: any) {
    await db().delete('starboard_messages', {
      guild_id: where.guildId,
      original_message_id: where.originalMessageId
    });
  }
};

export const ScheduledMessage = {
  async create(data: any) {
    const id = await db().insert('scheduled_messages', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      author_id: data.authorId,
      content: data.content,
      scheduled_for: data.scheduledFor,
      recurring: data.recurring || 'none'
    });
    return { id, _id: id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.sent !== undefined) converted.sent = where.sent ? 1 : 0;
    const results = await db().find('scheduled_messages', converted);
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findOneAndUpdate(where: any, update: any) {
    await db().update('scheduled_messages', update.$set || update, { id: where._id });
  },

  async findOneAndDelete(where: any) {
    const converted: any = {};
    if (where._id) converted.id = where._id;
    if (where.guildId) converted.guild_id = where.guildId;
    const existing = await db().findOne('scheduled_messages', converted);
    if (existing) {
      await db().delete('scheduled_messages', converted);
    }
    return existing;
  },

  async deleteOne(where: any) {
    return db().delete('scheduled_messages', { id: where._id });
  }
};

export const Poll = {
  async create(data: any) {
    const id = await db().insert('polls', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      message_id: data.messageId,
      author_id: data.authorId,
      question: data.question,
      options: data.options,
      ends_at: data.endsAt
    });
    return { id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.ended !== undefined) converted.ended = where.ended ? 1 : 0;
    return db().find('polls', converted);
  },

  async findOneAndUpdate(where: any, update: any) {
    await db().update('polls', update.$set || update, { id: where._id });
  }
};

export const CryptoAlert = {
  async create(data: any) {
    const id = await db().insert('crypto_alerts', {
      user_id: data.odId,
      channel_id: data.channelId,
      symbol: data.symbol,
      target_price: data.targetPrice,
      direction: data.direction
    });
    return { id, _id: id, ...data };
  },

  async find(where?: any) {
    if (!where) return db().find('crypto_alerts', { triggered: 0 });
    const results = await db().find('crypto_alerts', where);
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findOneAndUpdate(where: any, update: any) {
    await db().update('crypto_alerts', update.$set || update, { id: where._id });
  },

  async findByIdAndUpdate(id: number, update: any) {
    await db().update('crypto_alerts', update.$set || update, { id });
  }
};

export const MatchmakingQueue = {
  async create(data: any) {
    const id = await db().insert('matchmaking_queues', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      message_id: data.messageId,
      host_id: data.hostId,
      game_name: data.gameName,
      team_size: data.teamSize,
      team_count: data.teamCount,
      players: data.players || []
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.messageId) converted.message_id = where.messageId;
    if (where.status) converted.status = where.status;
    return db().findOne('matchmaking_queues', converted);
  },

  async findOneAndUpdate(where: any, update: any) {
    const data = update.$set || update;
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.messageId) converted.message_id = where.messageId;
    await db().update('matchmaking_queues', data, converted);
    return this.findOne(where);
  }
};

export const ActivityStreak = {
  async create(data: any) {
    const id = await db().insert('activity_streaks', {
      user_id: data.odId,
      guild_id: data.guildId,
      current_streak: data.currentStreak || 1,
      longest_streak: data.longestStreak || 1,
      last_activity: new Date().toISOString()
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    return db().findOne('activity_streaks', {
      user_id: where.odId,
      guild_id: where.guildId
    });
  },

  async findOneAndUpdate(where: any, update: any, options?: { upsert?: boolean }) {
    const data = update.$set || update;
    if (options?.upsert) {
      await db().upsert('activity_streaks', {
        user_id: where.odId,
        guild_id: where.guildId,
        ...data
      }, ['user_id', 'guild_id']);
    } else {
      await db().update('activity_streaks', data, {
        user_id: where.odId,
        guild_id: where.guildId
      });
    }
    return this.findOne(where);
  }
};

export const ReputationLog = {
  async create(data: any) {
    const id = await db().insert('reputation_logs', {
      guild_id: data.guildId,
      from_id: data.fromId,
      to_id: data.toId,
      type: data.type,
      reason: data.reason
    });
    return { id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.toId) converted.to_id = where.toId;
    if (where.fromId) converted.from_id = where.fromId;
    if (where.type) converted.type = where.type;
    return db().find('reputation_logs', converted);
  },

  async findOne(where: any) {
    return db().findOne('reputation_logs', {
      guild_id: where.guildId,
      from_id: where.fromId,
      to_id: where.toId
    });
  },

  async countDocuments(where: any) {
    const results = await this.find(where);
    return results.length;
  }
};

const CONFIG_SNAPSHOT_LIMIT = 20;

export const ConfigSnapshot = {
  async create(data: { guildId: string; label: string; createdBy: string; data: Record<string, any> }) {
    const existing = await db().find('config_snapshots', { guild_id: data.guildId });
    if (existing.length >= CONFIG_SNAPSHOT_LIMIT) {
      const oldest = [...existing].sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];
      if (oldest) await db().delete('config_snapshots', { id: oldest.id });
    }

    const id = await db().insert('config_snapshots', {
      guild_id: data.guildId,
      label: data.label,
      created_by: data.createdBy,
      data: data.data
    });
    return { id, _id: id, ...data };
  },

  async find(where: { guildId: string }) {
    const results = await db().find('config_snapshots', { guild_id: where.guildId });
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findById(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (!Number.isFinite(numId)) return null;
    const result = await db().findOne('config_snapshots', { id: numId });
    return result ? { ...result, _id: result.id } : null;
  },

  async findOneAndDelete(where: { _id: string | number; guildId: string }) {
    const numId = typeof where._id === 'string' ? parseInt(where._id, 10) : where._id;
    const existing = await db().findOne('config_snapshots', { id: numId, guild_id: where.guildId });
    if (existing) {
      await db().delete('config_snapshots', { id: numId, guild_id: where.guildId });
    }
    return existing;
  }
};

export const ChannelBackup = {
  async create(data: any) {
    const id = await db().insert('channel_backups', {
      guild_id: data.guildId,
      channel_id: data.channelId,
      channel_name: data.channelName,
      created_by: data.createdBy,
      messages_count: data.messagesCount,
      backup_data: data.backupData
    });
    return { id, _id: id, ...data };
  },

  async find(where: any) {
    const results = await db().find('channel_backups', { guild_id: where.guildId });
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findOne(where: any) {
    const result = await db().findOne('channel_backups', { id: where._id });
    return result ? { ...result, _id: result.id } : null;
  },

  async findById(id: string | number) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    const result = await db().findOne('channel_backups', { id: numId });
    return result ? { ...result, _id: result.id } : null;
  },

  async findOneAndDelete(where: any) {
    const converted: any = {};
    if (where._id) converted.id = where._id;
    if (where.guildId) converted.guild_id = where.guildId;
    const existing = await db().findOne('channel_backups', converted);
    if (existing) {
      await db().delete('channel_backups', converted);
    }
    return existing;
  }
};

export const MarketItem = {
  async create(data: any) {
    const id = await db().insert('market_items', {
      guild_id: data.guildId,
      seller_id: data.sellerId,
      item_name: data.itemName,
      item_type: data.itemType,
      price: data.price,
      quantity: data.quantity || 1
    });
    return { id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.sold !== undefined) converted.sold = where.sold ? 1 : 0;
    return db().find('market_items', converted);
  },

  async findOne(where: any) {
    return db().findOne('market_items', { id: where._id });
  },

  async findOneAndUpdate(where: any, update: any) {
    await db().update('market_items', update.$set || update, { id: where._id });
    return this.findOne(where);
  }
};

export const WeeklyDigest = {
  async create(data: any) {
    await db().upsert('guild_settings', {
      guild_id: `digest_${data.guildId}_${data.weekStart}`,
      modules: JSON.stringify(data)
    }, ['guild_id']);
    return data;
  },

  async findOne(where: any) {
    const result = await db().findOne('guild_settings', {
      guild_id: `digest_${where.guildId}_${where.weekStart}`
    });
    if (result?.modules) {
      return typeof result.modules === 'string' ? JSON.parse(result.modules) : result.modules;
    }
    return null;
  },

  async findOneAndUpdate(where: any, update: any, options?: { upsert?: boolean }) {
    const data = update.$set || update;
    const key = `digest_${where.guildId}_${where.weekStart}`;

    if (options?.upsert) {
      await db().upsert('guild_settings', {
        guild_id: key,
        modules: JSON.stringify(data)
      }, ['guild_id']);
    } else {
      await db().update('guild_settings', {
        modules: JSON.stringify(data)
      }, { guild_id: key });
    }
    return this.findOne(where);
  }
};

export const ModLog = {
  async create(data: any) {
    const id = await db().insert('mod_logs', {
      guild_id: data.guildId,
      user_id: data.odId ?? data.userId,
      moderator_id: data.moderatorId,
      action: data.action,
      reason: data.reason,
      duration: data.duration,
      created_at: new Date().toISOString()
    });
    return { id, ...data };
  },

  async findById(id: number) {
    return db().findOne('mod_logs', { id });
  },

  async find(where: any, options?: { sort?: Record<string, number>; limit?: number }) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.userId) converted.user_id = where.userId;
    if (where.odId) converted.user_id = where.odId;
    if (where.action) converted.action = where.action;
    let results = await db().find('mod_logs', converted);

    results = results.map((row: any) => ({
      ...row,
      guildId: row.guild_id,
      odId: row.user_id,
      moderatorId: row.moderator_id,
      createdAt: new Date(row.created_at)
    }));

    if (options?.sort) {
      const [field, order] = Object.entries(options.sort)[0];
      results.sort((a: any, b: any) => {
        if (field === 'createdAt') {
          return order === -1
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime();
        }
        return 0;
      });
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    return db().findOne('mod_logs', converted);
  },

  async countDocuments(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.userId) converted.user_id = where.userId;
    if (where.action) converted.action = where.action;
    const results = await db().find('mod_logs', converted);
    return results.length;
  }
};

export const MarketListing = {
  async create(data: any) {
    const id = await db().insert('market_items', {
      guild_id: data.guildId,
      seller_id: data.sellerId,
      item_type: data.itemType,
      item_name: data.itemName,
      price: data.price,
      quantity: data.quantity || 1,
      sold: 0,
      created_at: new Date().toISOString()
    });
    return { id, _id: id, ...data };
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.sellerId) converted.seller_id = where.sellerId;
    if (where.sold !== undefined) converted.sold = where.sold ? 1 : 0;
    if (where.status === 'active') converted.sold = 0;
    if (where.status === 'sold') converted.sold = 1;
    const results = await db().find('market_items', converted);
    return results.map((r: any) => ({ ...r, _id: r.id }));
  },

  async findOne(where: any) {
    if (where._id) return db().findOne('market_items', { id: typeof where._id === 'string' ? parseInt(where._id, 10) : where._id });
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.status === 'active') converted.sold = 0;
    if (where.status === 'sold') converted.sold = 1;
    return db().findOne('market_items', converted);
  },

  async findOneAndUpdate(where: any, update: any) {
    await db().update('market_items', update.$set || update, { id: where._id });
    return this.findOne(where);
  },

  async claimForPurchase(id: number, buyerId: string): Promise<boolean> {
    const affected = await db().update(
      'market_items',
      { sold: 1, buyer_id: buyerId, sold_at: new Date().toISOString() },
      { id, sold: 0 }
    );
    return affected > 0;
  },

  async findOneAndDelete(where: any) {
    const existing = await this.findOne(where);
    if (existing) {
      await db().delete('market_items', { id: where._id });
    }
    return existing;
  },

  async countDocuments(where: any) {
    const results = await this.find(where);
    return results.length;
  },

  async deleteOne(where: any) {
    await db().delete('market_items', { id: where._id });
  }
};

export const AfkStatus = {
  async create(data: any) {
    const id = await db().insert('afk_status', {
      guild_id: data.guildId,
      user_id: data.odId ?? data.userId,
      reason: data.reason,
      created_at: new Date().toISOString()
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.userId) converted.user_id = where.userId;
    return db().findOne('afk_status', converted);
  },

  async deleteOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.userId) converted.user_id = where.userId;
    await db().delete('afk_status', converted);
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    return db().find('afk_status', converted);
  }
};

export const UserQuest = {
  async create(data: any) {
    const id = await db().insert('user_quests', {
      guild_id: data.guildId,
      user_id: data.userId,
      quest_id: data.questId,
      progress: data.progress || 0,
      completed: 0,
      created_at: new Date().toISOString()
    });
    return { id, ...data };
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.questId) converted.quest_id = where.questId;
    return db().findOne('user_quests', converted);
  },

  async find(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.completed !== undefined) converted.completed = where.completed ? 1 : 0;
    return db().find('user_quests', converted);
  },

  async findOneAndUpdate(where: any, update: any, options?: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.questId) converted.quest_id = where.questId;

    const existing = await db().findOne('user_quests', converted);

    if (!existing && options?.upsert) {
      return this.create({
        guildId: where.guildId,
        odId: where.odId,
        questId: where.questId,
        ...update.$set
      });
    }

    if (existing) {
      const updateData = { ...update.$set };
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          updateData[key] = (existing[key] || 0) + (val as number);
        }
      }
      await db().update('user_quests', updateData, { id: existing.id });
    }

    return db().findOne('user_quests', converted);
  }
};

export const Ticket = {
  async nextNumber(guildId: string): Promise<number> {
    const existing = await db().find('tickets', { guild_id: guildId });
    const highest = existing.reduce(
      (max: number, row: any) => Math.max(max, Number(row.ticket_number) || 0),
      0
    );
    return db().nextCounterValue('ticket', guildId, highest);
  },

  async create(data: {
    guildId: string;
    odId: string;
    channelId: string;
    ticketNumber: number;
    status?: string;
    createdAt?: Date;
  }) {
    const id = await db().insert('tickets', {
      guild_id: data.guildId,
      user_id: data.odId,
      channel_id: data.channelId,
      ticket_number: data.ticketNumber,
      status: data.status || 'open',
      created_at: (data.createdAt || new Date()).toISOString()
    });
    return { id, ...data, save: async () => {} };
  },

  async findOne(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    if (where.odId) converted.user_id = where.odId;
    if (where.channelId) converted.channel_id = where.channelId;
    if (where.status) {
      if (where.status.$in) {
        const results = await db().find('tickets', converted);
        const filtered = results.filter((r: any) => where.status.$in.includes(r.status));
        if (filtered.length === 0) return null;
        return this._wrapTicket(filtered[0]);
      } else {
        converted.status = where.status;
      }
    }
    const result = await db().findOne('tickets', converted);
    return result ? this._wrapTicket(result) : null;
  },

  async countDocuments(where: any) {
    const converted: any = {};
    if (where.guildId) converted.guild_id = where.guildId;
    const results = await db().find('tickets', converted);
    return results.length;
  },

  async deleteOne(where: any) {
    const converted: any = {};
    if (where.channelId) converted.channel_id = where.channelId;
    if (where.guildId) converted.guild_id = where.guildId;
    await db().delete('tickets', converted);
  },

  _wrapTicket(data: any) {
    const ticket: any = {
      id: data.id,
      guildId: data.guild_id,
      odId: data.user_id,
      channelId: data.channel_id,
      ticketNumber: data.ticket_number,
      status: data.status,
      claimedBy: data.claimed_by,
      closedBy: data.closed_by,
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
      createdAt: new Date(data.created_at),
      save: async function() {
        await db().update('tickets', {
          status: this.status,
          claimed_by: this.claimedBy,
          closed_by: this.closedBy,
          closed_at: this.closedAt?.toISOString()
        }, { id: this.id });
      }
    };
    return ticket;
  }
};

export const Jail = {
  async create(data: { guildId: string; userId: string; roles: string[]; moderatorId?: string; reason?: string }) {
    const id = await db().insert('jail', {
      guild_id: data.guildId,
      user_id: data.userId,
      roles: data.roles,
      moderator_id: data.moderatorId,
      reason: data.reason
    });
    return { id, ...data };
  },
  async findOne(where: { guildId: string; userId: string }) {
    return db().findOne('jail', { guild_id: where.guildId, user_id: where.userId });
  },
  async remove(where: { guildId: string; userId: string }) {
    return db().delete('jail', { guild_id: where.guildId, user_id: where.userId });
  }
};

export const ShadowMute = {
  async add(data: { guildId: string; userId: string; moderatorId?: string }) {
    const existing = await this.findOne(data);
    if (existing) return existing;
    const id = await db().insert('shadow_mutes', {
      guild_id: data.guildId,
      user_id: data.userId,
      moderator_id: data.moderatorId
    });
    return { id, ...data };
  },
  async findOne(where: { guildId: string; userId: string }) {
    return db().findOne('shadow_mutes', { guild_id: where.guildId, user_id: where.userId });
  },
  async remove(where: { guildId: string; userId: string }) {
    return db().delete('shadow_mutes', { guild_id: where.guildId, user_id: where.userId });
  }
};

export const NameHistory = {
  async add(data: { guildId?: string; userId: string; type: 'username' | 'globalName' | 'nickname'; value: string | null }) {
    return db().insert('name_history', {
      guild_id: data.guildId || 'global',
      user_id: data.userId,
      type: data.type,
      value: data.value ?? null
    });
  },

  async forUser(userId: string, limit = 25) {
    return db().find('name_history', { user_id: userId }, { orderBy: 'changed_at DESC', limit });
  },

  async forMember(guildId: string, userId: string, limit = 25) {
    const rows = await this.forUser(userId, 200);
    return rows
      .filter((r: any) => r.type !== 'nickname' || r.guild_id === guildId)
      .slice(0, limit);
  }
};

export const PersistedRoles = {
  async save(data: { guildId: string; userId: string; roles: string[]; nickname?: string | null }) {
    return db().upsert('persisted_roles', {
      guild_id: data.guildId,
      user_id: data.userId,
      roles: data.roles,
      nickname: data.nickname ?? null,
      saved_at: new Date().toISOString()
    }, ['guild_id', 'user_id']);
  },

  async get(guildId: string, userId: string): Promise<{ roles: string[]; nickname: string | null } | null> {
    const row: any = await db().findOne('persisted_roles', { guild_id: guildId, user_id: userId });
    if (!row) return null;
    let roles: string[];
    try {
      roles = Array.isArray(row.roles) ? row.roles : JSON.parse(row.roles || '[]');
    } catch {
      roles = [];
    }
    return { roles, nickname: row.nickname ?? null };
  },

  async clear(guildId: string, userId: string) {
    return db().delete('persisted_roles', { guild_id: guildId, user_id: userId });
  }
};

export const FeatureToggle = {
  async isEnabled(guildId: string, feature: string): Promise<boolean> {
    const row: any = await db().findOne('feature_toggles', { guild_id: guildId, feature });
    if (!row) return false;
    return row.enabled === true || row.enabled === 1;
  },

  async set(guildId: string, feature: string, enabled: boolean) {
    return db().upsert('feature_toggles', {
      guild_id: guildId,
      feature,
      enabled: enabled ? 1 : 0,
      updated_at: new Date().toISOString()
    }, ['guild_id', 'feature']);
  }
};
