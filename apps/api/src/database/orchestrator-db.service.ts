import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { migrate } from './schema';

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
    migrate(db);
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
