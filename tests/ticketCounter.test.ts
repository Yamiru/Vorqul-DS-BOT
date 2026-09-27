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

function makeManager(tables: string[]) {
  const inst: any = Object.create(DatabaseManager.prototype);
  inst.config = { type: 'sqlite' };
  const db = new DatabaseSync(':memory:');
  const defs = inst.getTableDefinitions();
  for (const t of tables) db.exec(defs[t].sqlite);
  inst.sqliteDb = db;
  return inst;
}

describe.skipIf(!DatabaseSync)('ticket numbering', () => {
  it('never reuses a number after a ticket is deleted', async () => {
    const mgr = makeManager(['tickets', 'counters']);

    const numbers: number[] = [];
    for (let i = 0; i < 8; i++) {
      const n = await mgr.nextCounterValue('ticket', 'g1', 0);
      numbers.push(n);
      await mgr.insert('tickets', {
        guild_id: 'g1', user_id: 'u', channel_id: `c${n}`, ticket_number: n, status: 'open'
      });
    }
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    await mgr.delete('tickets', { ticket_number: 8 });
    await mgr.delete('tickets', { ticket_number: 3 });

    const next = await mgr.nextCounterValue('ticket', 'g1', 0);
    expect(next).toBe(9);
  });

  it('gives every concurrent request a distinct number', async () => {
    const mgr = makeManager(['tickets', 'counters']);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => mgr.nextCounterValue('ticket', 'g1', 0))
    );

    expect(new Set(results).size).toBe(50);
    expect(Math.max(...results)).toBe(50);
  });

  it('keeps counters separate per guild', async () => {
    const mgr = makeManager(['tickets', 'counters']);
    expect(await mgr.nextCounterValue('ticket', 'g1', 0)).toBe(1);
    expect(await mgr.nextCounterValue('ticket', 'g2', 0)).toBe(1);
    expect(await mgr.nextCounterValue('ticket', 'g1', 0)).toBe(2);
  });

  it('seeds from existing tickets so live servers do not restart at 1', async () => {
    const mgr = makeManager(['tickets', 'counters']);
    expect(await mgr.nextCounterValue('ticket', 'g1', 42)).toBe(43);
    expect(await mgr.nextCounterValue('ticket', 'g1', 42)).toBe(44);
  });
});

describe.skipIf(!DatabaseSync)('atomic transfer primitives', () => {
  it('refuses to debit below the requested amount', async () => {
    const mgr = makeManager(['user_data']);
    await mgr.insert('user_data', { user_id: 'a', guild_id: 'g1', balance: 100 });

    const where = { user_id: 'a', guild_id: 'g1' };
    expect(await mgr.decrementIfAtLeast('user_data', 'balance', 150, where)).toBe(false);
    expect((await mgr.findOne('user_data', where)).balance).toBe(100);

    expect(await mgr.decrementIfAtLeast('user_data', 'balance', 100, where)).toBe(true);
    expect((await mgr.findOne('user_data', where)).balance).toBe(0);
  });

  it('lets only as many concurrent purchases through as the balance covers', async () => {
    const mgr = makeManager(['user_data']);
    await mgr.insert('user_data', { user_id: 'a', guild_id: 'g1', balance: 250 });

    const where = { user_id: 'a', guild_id: 'g1' };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => mgr.decrementIfAtLeast('user_data', 'balance', 100, where))
    );

    expect(results.filter(Boolean).length).toBe(2);
    expect((await mgr.findOne('user_data', where)).balance).toBe(50);
  });
});
