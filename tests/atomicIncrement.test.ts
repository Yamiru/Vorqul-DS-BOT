import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let DatabaseSync: any = null;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  DatabaseSync = null;
}

const mod = await import('../src/utils/database.js');
const DatabaseManager: any = (mod as any).DatabaseManager || (mod as any).default;

function makeSqliteManager() {
  const inst: any = Object.create(DatabaseManager.prototype);
  inst.config = { type: 'sqlite' };
  const db = new DatabaseSync(':memory:');
  db.exec(inst.getTableDefinitions().user_data.sqlite);
  inst.sqliteDb = db;
  return inst;
}

describe.skipIf(!DatabaseSync)('atomic increment', () => {
  it('does not lose concurrent balance updates', async () => {
    const mgr = makeSqliteManager();
    await mgr.insert('user_data', { user_id: 'u1', guild_id: 'g1', balance: 0 });

    const where = { user_id: 'u1', guild_id: 'g1' };
    await Promise.all(
      Array.from({ length: 200 }, () => mgr.increment('user_data', { balance: 1 }, where))
    );

    const row: any = await mgr.findOne('user_data', where);
    expect(row.balance).toBe(200);
  });

  it('applies negative increments and extra set fields together', async () => {
    const mgr = makeSqliteManager();
    await mgr.insert('user_data', { user_id: 'u2', guild_id: 'g1', balance: 500, bank: 0 });

    const where = { user_id: 'u2', guild_id: 'g1' };
    await mgr.increment('user_data', { balance: -200, bank: 200 }, where, { level: 7 });

    const row: any = await mgr.findOne('user_data', where);
    expect(row.balance).toBe(300);
    expect(row.bank).toBe(200);
    expect(row.level).toBe(7);
  });

  it('treats a null column as zero instead of failing', async () => {
    const mgr = makeSqliteManager();
    await mgr.insert('user_data', { user_id: 'u3', guild_id: 'g1' });

    const where = { user_id: 'u3', guild_id: 'g1' };
    await mgr.increment('user_data', { reputation: 5 }, where);

    const row: any = await mgr.findOne('user_data', where);
    expect(row.reputation).toBe(5);
  });
});
