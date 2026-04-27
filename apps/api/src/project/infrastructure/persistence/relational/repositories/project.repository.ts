import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Project } from '../../../../domain/project';
import {
  ProjectCreatePayload,
  ProjectCreateResult,
  ProjectRepository,
} from '../../project.repository';
import { ProjectEntity } from '../entities/project.entity';
import { ProjectMapper } from '../mappers/project.mapper';

@Injectable()
export class ProjectRelationalRepository extends ProjectRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  list(): Project[] {
    const rows = this.dbs.db
      .prepare<
        unknown[],
        ProjectEntity
      >('SELECT * FROM projects ORDER BY created_at DESC')
      .all();
    return rows.map((r) => ProjectMapper.toDomain(r));
  }

  findByPath(path: string): Project | null {
    const row = this.dbs.db
      .prepare<[string], ProjectEntity>('SELECT * FROM projects WHERE path = ?')
      .get(path);
    return row ? ProjectMapper.toDomain(row) : null;
  }

  exists(path: string): boolean {
    const row = this.dbs.db
      .prepare<
        [string],
        { _: number }
      >('SELECT 1 AS _ FROM projects WHERE path = ?')
      .get(path);
    return Boolean(row);
  }

  create(payload: ProjectCreatePayload): ProjectCreateResult {
    const db = this.dbs.db;
    let conflict = false;
    const tx = db.transaction(() => {
      try {
        db.prepare(
          'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        ).run(payload.path, payload.name, payload.now, payload.now);
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE')) {
          conflict = true;
          return;
        }
        throw e;
      }
      db.prepare(
        'INSERT INTO plots (project_path, content, updated_at) VALUES (?, ?, ?)',
      ).run(payload.path, payload.plotContent, payload.now);
      db.prepare(
        'INSERT INTO knowledge (project_path, content, updated_at) VALUES (?, ?, ?)',
      ).run(payload.path, payload.knowledgeContent, payload.now);
    });
    tx.immediate();
    if (conflict) return { ok: false, reason: 'project_exists' };
    const created = this.findByPath(payload.path);
    if (!created) {
      throw new Error(`project ${payload.path} not found after insert`);
    }
    return { ok: true, project: created };
  }

  rename(path: string, name: string, now: number): Project {
    this.dbs.db
      .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE path = ?')
      .run(name, now, path);
    const updated = this.findByPath(path);
    if (!updated) {
      throw new Error(`project ${path} not found after rename`);
    }
    return updated;
  }

  delete(path: string): { cascadedAgents: number } {
    const count = (
      this.dbs.db
        .prepare<
          [string],
          { c: number }
        >('SELECT COUNT(*) AS c FROM agents WHERE project_path = ?')
        .get(path) as { c: number }
    ).c;
    this.dbs.db.prepare('DELETE FROM projects WHERE path = ?').run(path);
    return { cascadedAgents: count };
  }
}
