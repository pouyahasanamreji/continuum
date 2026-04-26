import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  applied_diff TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  slug TEXT PRIMARY KEY,
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
  abandoned_reason TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
`;

@Injectable()
export class OrchestratorDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrchestratorDbService.name);
  private _db: Database.Database | null = null;

  onModuleInit(): void {
    const path = process.env.ORCHESTRATOR_DB_PATH ?? '/data/orchestrator.db';
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA_SQL);
    this._db = db;
    this.logger.log(`Opened SQLite at ${path}`);
  }

  onModuleDestroy(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  get db(): Database.Database {
    if (!this._db) throw new Error('OrchestratorDbService not initialised');
    return this._db;
  }
}
