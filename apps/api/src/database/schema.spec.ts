import Database from 'better-sqlite3';
import { migrate, SCHEMA_VERSION } from './schema';

interface ColumnInfo {
  name: string;
}

interface IndexInfo {
  name: string;
  unique: number;
}

describe('migrate idempotency', () => {
  it(`two migrate calls on fresh DB then a third leaves user_version=${SCHEMA_VERSION} with empty tables`, () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    migrate(db);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    for (const t of [
      'projects',
      'plots',
      'plot_history',
      'knowledge',
      'agents',
      'app_settings',
    ]) {
      expect(
        (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c,
      ).toBe(0);
    }
    const kcols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(knowledge)')
      .all()
      .map((c) => c.name);
    expect(kcols).toEqual(
      expect.arrayContaining([
        'agent_id',
        'slug',
        'content',
        'created_at',
        'updated_at',
        'deleted_at',
      ]),
    );
    const kIndexes = db
      .prepare<unknown[], IndexInfo>('PRAGMA index_list(knowledge)')
      .all();
    expect(kIndexes.some((i) => i.unique === 1)).toBe(true);

    const pcols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(plots)')
      .all()
      .map((c) => c.name);
    expect(pcols).toEqual(expect.arrayContaining(['created_at', 'deleted_at']));
  });
});
