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
        'kind',
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

describe('migrate v7 → v8 incremental', () => {
  it('adds kind column with default situational; preserves rows; enforces CHECK', () => {
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
      CREATE TABLE knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        agent_id   INTEGER NOT NULL REFERENCES agents(id)   ON DELETE CASCADE,
        slug       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER NULL,
        UNIQUE(project_id, slug)
      );
    `);
    db.pragma('user_version = 7');

    const now = Date.now();
    const projInfo = db
      .prepare(
        `INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      )
      .run('/tmp/p', 'p', now, now);
    const projectId = Number(projInfo.lastInsertRowid);
    const agentInfo = db
      .prepare(
        `INSERT INTO agents (project_id, slug, status, branch, worktree, created_at, updated_at)
         VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      )
      .run(projectId, 'alpha', 'feat/alpha', '/tmp/wt', now, now);
    const agentId = Number(agentInfo.lastInsertRowid);
    db.prepare(
      `INSERT INTO knowledge (project_id, agent_id, slug, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(projectId, agentId, 'one', 'body', now, now);

    migrate(db);

    expect(db.pragma('user_version', { simple: true })).toBe(8);
    const kcols = db
      .prepare<unknown[], ColumnInfo>('PRAGMA table_info(knowledge)')
      .all()
      .map((c) => c.name);
    expect(kcols).toContain('kind');

    const existing = db
      .prepare<
        [string],
        { kind: string }
      >('SELECT kind FROM knowledge WHERE slug = ?')
      .get('one');
    expect(existing?.kind).toBe('situational');

    db.prepare(
      `INSERT INTO knowledge (project_id, agent_id, slug, content, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(projectId, agentId, 'two', 'body', 'fundamental', now, now);
    const fund = db
      .prepare<
        [string],
        { kind: string }
      >('SELECT kind FROM knowledge WHERE slug = ?')
      .get('two');
    expect(fund?.kind).toBe('fundamental');

    expect(() =>
      db
        .prepare(
          `INSERT INTO knowledge (project_id, agent_id, slug, content, kind, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(projectId, agentId, 'three', 'body', 'invalid', now, now),
    ).toThrow();
  });
});
