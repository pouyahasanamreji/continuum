import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 3;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER NULL
);

CREATE TABLE IF NOT EXISTS plots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plot_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  applied_diff TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plot_history_project ON plot_history(project_id);

CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  applied_diff TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_history_project ON knowledge_history(project_id);

CREATE TABLE IF NOT EXISTS agents (
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
CREATE INDEX IF NOT EXISTS idx_agents_project_status ON agents(project_id, status);
`;

const DROP_LEGACY_SQL = `
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS knowledge_history;
DROP TABLE IF EXISTS knowledge;
DROP TABLE IF EXISTS plot_history;
DROP TABLE IF EXISTS plots;
DROP TABLE IF EXISTS projects;
`;

export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current >= SCHEMA_VERSION) {
    db.exec(SCHEMA_SQL);
    return;
  }

  const allowDestructive =
    process.env.NODE_ENV !== 'production' ||
    process.env.ORCHESTRATOR_ALLOW_DESTRUCTIVE_MIGRATE === '1';
  if (!allowDestructive) {
    throw new Error(
      `Refusing destructive migration v${current}→v${SCHEMA_VERSION} in production. ` +
        `Set ORCHESTRATOR_ALLOW_DESTRUCTIVE_MIGRATE=1 to opt in (this WIPES all data).`,
    );
  }

  db.pragma('foreign_keys = OFF');
  try {
    const tx = db.transaction(() => {
      db.exec(DROP_LEGACY_SQL);
      db.exec(SCHEMA_SQL);
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    });
    tx.immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
