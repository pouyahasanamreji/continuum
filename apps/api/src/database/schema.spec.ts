import Database from 'better-sqlite3';
import { migrate } from './schema';

describe('migrate idempotency', () => {
  it('two migrate calls on fresh DB then a third leaves user_version=2 with empty tables', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    migrate(db);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    for (const t of [
      'projects',
      'plots',
      'plot_history',
      'knowledge',
      'knowledge_history',
      'agents',
    ]) {
      expect(
        (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c,
      ).toBe(0);
    }
  });
});
