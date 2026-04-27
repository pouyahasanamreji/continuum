import Database from 'better-sqlite3';
import { migrate, SCHEMA_VERSION } from './schema';

interface ColumnInfo {
  name: string;
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
      'knowledge_history',
      'agents',
    ]) {
      expect(
        (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c,
      ).toBe(0);
    }
    const cols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(knowledge)')
      .all()
      .map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['created_at', 'deleted_at']));
  });
});

describe('migrate v3 → v4 incremental', () => {
  it('adds created_at + deleted_at, backfills created_at = updated_at, preserves data', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER NULL
      );
      CREATE TABLE knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db.pragma('user_version = 3');
    db.prepare(
      'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('/tmp/p', 'p', 1000, 1000);
    db.prepare(
      'INSERT INTO knowledge (project_id, content, updated_at) VALUES (?, ?, ?)',
    ).run(1, 'old', 12345);

    migrate(db);

    expect(db.pragma('user_version', { simple: true })).toBe(4);
    const cols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(knowledge)')
      .all()
      .map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['created_at', 'deleted_at']));
    const row = db
      .prepare<
        unknown[],
        {
          content: string;
          created_at: number;
          updated_at: number;
          deleted_at: number | null;
        }
      >(
        'SELECT content, created_at, updated_at, deleted_at FROM knowledge WHERE project_id = 1',
      )
      .get();
    expect(row).toBeDefined();
    expect(row!.content).toBe('old');
    expect(row!.created_at).toBe(12345);
    expect(row!.updated_at).toBe(12345);
    expect(row!.deleted_at).toBeNull();
  });
});
