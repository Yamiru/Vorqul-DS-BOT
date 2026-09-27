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

describe.skipIf(!DatabaseSync)('index definitions', () => {
  it('every indexed column exists in the sqlite schema', () => {
    const inst: any = Object.create(DatabaseManager.prototype);
    inst.config = { type: 'sqlite' };
    const tables = inst.getTableDefinitions();
    const indexes = inst.getIndexDefinitions();

    const problems: string[] = [];
    for (const idx of indexes) {
      const def = tables[idx.table];
      if (!def) { problems.push(`missing table ${idx.table}`); continue; }
      for (const col of idx.columns) {
        if (!new RegExp(`^\\s*${col}\\s`, 'm').test(def.sqlite)) {
          problems.push(`${idx.table}.${col}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('indexes actually apply to a real sqlite database', () => {
    const inst: any = Object.create(DatabaseManager.prototype);
    inst.config = { type: 'sqlite' };
    const tables = inst.getTableDefinitions();
    const indexes = inst.getIndexDefinitions();

    const db = new DatabaseSync(':memory:');
    for (const def of Object.values<any>(tables)) db.exec(def.sqlite);

    let created = 0;
    for (const idx of indexes) {
      const def = tables[idx.table];
      if (!def) continue;
      if (idx.columns.some((c: string) => !new RegExp(`^\\s*${c}\\s`, 'm').test(def.sqlite))) continue;
      const name = `idx_${idx.table}_${idx.columns.join('_')}`;
      db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${idx.table} (${idx.columns.join(', ')})`);
      created++;
    }

    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
    expect(rows.length).toBe(created);
    expect(created).toBeGreaterThan(30);
  });
});
