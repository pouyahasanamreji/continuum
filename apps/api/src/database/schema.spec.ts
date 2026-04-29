import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { migrate, SCHEMA_VERSION } from './schema';

interface ColumnInfo {
  name: string;
}

interface IndexInfo {
  name: string;
  unique: number;
}

function loadVec(db: Database.Database): void {
  if (typeof (sqliteVec as { load?: unknown }).load === 'function') {
    (sqliteVec as { load: (d: Database.Database) => void }).load(db);
  } else {
    db.loadExtension(
      (sqliteVec as { getLoadablePath: () => string }).getLoadablePath(),
    );
  }
}

describe('migrate idempotency', () => {
  it(`two migrate calls on fresh DB then a third leaves user_version=${SCHEMA_VERSION} with empty tables`, () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    loadVec(db);
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

    const vec = db
      .prepare<
        unknown[],
        { name: string }
      >("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_vec'")
      .get();
    expect(vec?.name).toBe('knowledge_vec');

    const trig = db
      .prepare<
        unknown[],
        { name: string }
      >("SELECT name FROM sqlite_master WHERE type='trigger' AND name='knowledge_vec_cleanup'")
      .get();
    expect(trig?.name).toBe('knowledge_vec_cleanup');
  });
});

describe('migrate v8 → v9 incremental', () => {
  it('adds knowledge_vec virtual table + cleanup trigger; preserves rows', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    loadVec(db);

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
        kind       TEXT NOT NULL DEFAULT 'situational'
                   CHECK (kind IN ('fundamental','situational')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER NULL,
        UNIQUE(project_id, slug)
      );
    `);
    db.pragma('user_version = 8');

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
    const kInfo = db
      .prepare(
        `INSERT INTO knowledge (project_id, agent_id, slug, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(projectId, agentId, 'one', 'body', now, now);
    const knowledgeId = Number(kInfo.lastInsertRowid);

    migrate(db);

    expect(db.pragma('user_version', { simple: true })).toBe(9);
    const vec = db
      .prepare<
        unknown[],
        { name: string }
      >("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_vec'")
      .get();
    expect(vec?.name).toBe('knowledge_vec');

    const preserved = db
      .prepare<
        [string],
        { content: string }
      >('SELECT content FROM knowledge WHERE slug = ?')
      .get('one');
    expect(preserved?.content).toBe('body');

    const buf = Buffer.from(new Float32Array(768).fill(0.1).buffer);
    db.prepare(
      `INSERT INTO knowledge_vec (knowledge_id, embedding) VALUES (?, ?)`,
    ).run(BigInt(knowledgeId), buf);
    const vecCount = () => {
      const row = db
        .prepare('SELECT count(*) AS c FROM knowledge_vec')
        .get() as { c: number };
      return row.c;
    };
    expect(vecCount()).toBe(1);

    db.prepare('DELETE FROM knowledge WHERE id = ?').run(knowledgeId);
    expect(vecCount()).toBe(0);
  });
});
