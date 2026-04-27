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
      >(
        'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC',
      )
      .all();
    return rows.map((r) => ProjectMapper.toDomain(r));
  }

  findIdByPath(path: string): number | null {
    const row = this.dbs.db
      .prepare<
        [string],
        { id: number }
      >('SELECT id FROM projects WHERE path = ? AND deleted_at IS NULL')
      .get(path);
    return row ? row.id : null;
  }

  findByPath(path: string): Project | null {
    const row = this.dbs.db
      .prepare<
        [string],
        ProjectEntity
      >(
        'SELECT * FROM projects WHERE path = ? AND deleted_at IS NULL',
      )
      .get(path);
    return row ? ProjectMapper.toDomain(row) : null;
  }

  exists(path: string): boolean {
    return this.findIdByPath(path) !== null;
  }

  create(payload: ProjectCreatePayload): ProjectCreateResult {
    const db = this.dbs.db;
    let conflict = false;
    let projectId: number | null = null;
    const tx = db.transaction(() => {
      try {
        const info = db
          .prepare(
            'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          )
          .run(payload.path, payload.name, payload.now, payload.now);
        projectId = Number(info.lastInsertRowid);
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE')) {
          conflict = true;
          return;
        }
        throw e;
      }
      db.prepare(
        'INSERT INTO plots (project_id, content, updated_at) VALUES (?, ?, ?)',
      ).run(projectId, payload.plotContent, payload.now);
      db.prepare(
        'INSERT INTO knowledge (project_id, content, updated_at) VALUES (?, ?, ?)',
      ).run(projectId, payload.knowledgeContent, payload.now);
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
      .prepare(
        'UPDATE projects SET name = ?, updated_at = ? WHERE path = ? AND deleted_at IS NULL',
      )
      .run(name, now, path);
    const updated = this.findByPath(path);
    if (!updated) {
      throw new Error(`project ${path} not found after rename`);
    }
    return updated;
  }

  delete(path: string): { cascadedAgents: number } {
    const id = this.findIdByPath(path);
    if (id === null) return { cascadedAgents: 0 };
    const count = (
      this.dbs.db
        .prepare<
          [number],
          { c: number }
        >('SELECT COUNT(*) AS c FROM agents WHERE project_id = ?')
        .get(id) as { c: number }
    ).c;
    this.dbs.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return { cascadedAgents: count };
  }
}
