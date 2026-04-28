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
    expect(kcols).toEqual(expect.arrayContaining(['created_at', 'deleted_at']));
    const pcols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(plots)')
      .all()
      .map((c) => c.name);
    expect(pcols).toEqual(expect.arrayContaining(['created_at', 'deleted_at']));
  });
});

describe('migrate v5 → v6 incremental', () => {
  it('adds app_settings, preserves preexisting rows', () => {
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
      CREATE TABLE plots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER NULL
      );
      CREATE TABLE plot_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        applied_diff TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER NULL
      );
      CREATE TABLE knowledge_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        applied_diff TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','active','merged','abandoned')),
        branch TEXT NOT NULL,
        worktree TEXT NOT NULL,
        reserved_paths_json TEXT NOT NULL DEFAULT '[]',
        request TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT '',
        impl_prompt TEXT NOT NULL DEFAULT '',
        coordination_brief TEXT NOT NULL DEFAULT '',
        post_merge_notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        dispatched_at INTEGER NULL,
        updated_at INTEGER NOT NULL,
        merged_at INTEGER NULL,
        merged_commit TEXT NULL CHECK (merged_commit IS NULL OR length(merged_commit) >= 7),
        abandoned_reason TEXT NULL,
        deleted_at INTEGER NULL,
        UNIQUE(project_id, slug)
      );
    `);
    db.pragma('user_version = 5');
    db.prepare(
      'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run('/tmp/p', 'p', 1000, 1000);
    db.prepare(
      'INSERT INTO plots (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(1, 'plot-keep', 2000, 2000);
    db.prepare(
      'INSERT INTO knowledge (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(1, 'know-keep', 2000, 2000);

    migrate(db);

    expect(db.pragma('user_version', { simple: true })).toBe(6);
    const cols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(app_settings)')
      .all()
      .map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['key', 'value', 'updated_at']),
    );
    expect(
      (
        db.prepare('SELECT COUNT(*) AS c FROM app_settings').get() as {
          c: number;
        }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare<
            [number],
            { content: string }
          >('SELECT content FROM plots WHERE project_id = ?')
          .get(1) as { content: string }
      ).content,
    ).toBe('plot-keep');
    expect(
      (
        db
          .prepare<
            [number],
            { content: string }
          >('SELECT content FROM knowledge WHERE project_id = ?')
          .get(1) as { content: string }
      ).content,
    ).toBe('know-keep');
  });
});
