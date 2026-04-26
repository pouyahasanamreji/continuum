import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { OrchestratorDbService } from './db.service';
import { PlotService } from './plot.service';
import type { ProjectFull } from './types';

export type ProjectErrorReason =
  | 'invalid_path'
  | 'invalid_name'
  | 'project_exists'
  | 'project_not_found';

export class ProjectServiceError extends Error {
  constructor(
    public readonly reason: ProjectErrorReason,
    public readonly detail?: string,
  ) {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
    this.name = 'ProjectServiceError';
  }
}

interface ProjectRow {
  path: string;
  name: string;
  created_at: number;
  updated_at: number;
}

function rowToFull(row: ProjectRow): ProjectFull {
  return {
    path: row.path,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly dbs: OrchestratorDbService,
    private readonly plot: PlotService,
  ) {}

  canonicalize(input: string): string {
    if (typeof input !== 'string' || input.length === 0) {
      throw new ProjectServiceError('invalid_path', 'empty');
    }
    if (input.startsWith('~')) {
      throw new ProjectServiceError(
        'invalid_path',
        'tilde-expansion not supported',
      );
    }
    if (!input.startsWith('/')) {
      throw new ProjectServiceError(
        'invalid_path',
        'must be absolute (start with /)',
      );
    }
    if (input.includes('\\')) {
      throw new ProjectServiceError('invalid_path', 'backslash not allowed');
    }
    let p = input.normalize('NFC').replace(/\/+/g, '/');
    if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
    if (p === '/') {
      throw new ProjectServiceError('invalid_path', 'root not allowed');
    }
    if (/(^|\/)\.{1,2}(\/|$)/.test(p)) {
      throw new ProjectServiceError(
        'invalid_path',
        'relative segments not allowed',
      );
    }
    if (p.length > 1024) {
      throw new ProjectServiceError(
        'invalid_path',
        'path too long (>1024 chars)',
      );
    }
    return p;
  }

  list(): ProjectFull[] {
    const rows = this.dbs.db
      .prepare<
        unknown[],
        ProjectRow
      >('SELECT * FROM projects ORDER BY created_at DESC')
      .all();
    return rows.map(rowToFull);
  }

  get(path: string): ProjectFull | null {
    const row = this.dbs.db
      .prepare<[string], ProjectRow>('SELECT * FROM projects WHERE path = ?')
      .get(path);
    return row ? rowToFull(row) : null;
  }

  assertExists(path: string): void {
    if (!this.get(path)) {
      throw new ProjectServiceError('project_not_found', path);
    }
  }

  create(input: { path: string; name?: string }): ProjectFull {
    const path = this.canonicalize(input.path);
    const name = (input.name ?? basename(path)).trim();
    if (!name) {
      throw new ProjectServiceError('invalid_name', 'empty after trim');
    }
    if (/[\r\n]/.test(name)) {
      throw new ProjectServiceError('invalid_name', 'newlines not allowed');
    }
    const now = Date.now();
    const db = this.dbs.db;
    const tx = db.transaction(() => {
      try {
        db.prepare(
          'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        ).run(path, name, now, now);
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE')) {
          throw new ProjectServiceError('project_exists', path);
        }
        throw e;
      }
      db.prepare(
        'INSERT INTO plots (project_path, content, updated_at) VALUES (?, ?, ?)',
      ).run(path, this.plot.defaultTemplate(), now);
      db.prepare(
        'INSERT INTO knowledge (project_path, content, updated_at) VALUES (?, ?, ?)',
      ).run(path, '', now);
    });
    tx.immediate();
    return this.get(path)!;
  }

  rename(path: string, newName: string): ProjectFull {
    const canonical = this.canonicalize(path);
    this.assertExists(canonical);
    const trimmed = newName.trim();
    if (!trimmed || /[\r\n]/.test(trimmed)) {
      throw new ProjectServiceError('invalid_name');
    }
    this.dbs.db
      .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE path = ?')
      .run(trimmed, Date.now(), canonical);
    return this.get(canonical)!;
  }

  delete(path: string): { deleted: true; cascadedAgents: number } {
    const canonical = this.canonicalize(path);
    this.assertExists(canonical);
    const count = (
      this.dbs.db
        .prepare<
          [string],
          { c: number }
        >('SELECT COUNT(*) AS c FROM agents WHERE project_path = ?')
        .get(canonical) as { c: number }
    ).c;
    this.dbs.db.prepare('DELETE FROM projects WHERE path = ?').run(canonical);
    return { deleted: true, cascadedAgents: count };
  }
}
