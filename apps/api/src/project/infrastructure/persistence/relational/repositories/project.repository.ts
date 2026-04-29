import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Project } from '../../../../domain/project';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  FilterProjectDto,
  SortProjectDto,
} from '../../../../dto/query-project.dto';
import {
  ProjectCreatePayload,
  ProjectCreateResult,
  ProjectRepository,
  ProjectUpdatePatch,
} from '../../project.repository';
import { ProjectEntity } from '../entities/project.entity';
import { ProjectMapper } from '../mappers/project.mapper';

const ORDER_COLUMNS = {
  id: 'id',
  path: 'path',
  name: 'name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
} as const;

@Injectable()
export class ProjectRelationalRepository extends ProjectRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  findAll(): Project[] {
    const rows = this.dbs.db
      .prepare<
        unknown[],
        ProjectEntity
      >('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC')
      .all();
    return rows.map((r) => ProjectMapper.toDomain(r));
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProjectDto | null;
    sortOptions?: SortProjectDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Project[] {
    const where: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (filterOptions?.path) {
      where.push('path = ?');
      params.push(filterOptions.path);
    }

    const orderClauses: string[] = [];
    if (sortOptions?.length) {
      for (const s of sortOptions) {
        if (!Object.hasOwn(ORDER_COLUMNS, s.orderBy)) continue;
        const dir = (s.order ?? '').toUpperCase();
        if (dir !== 'ASC' && dir !== 'DESC') continue;
        const col = ORDER_COLUMNS[s.orderBy];
        orderClauses.push(`${col} ${dir}`);
      }
    }
    const orderBy =
      orderClauses.length > 0 ? orderClauses.join(', ') : 'created_at DESC';

    const sql = `SELECT * FROM projects WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const rows = this.dbs.db
      .prepare<(string | number)[], ProjectEntity>(sql)
      .all(
        ...params,
        paginationOptions.limit,
        (paginationOptions.page - 1) * paginationOptions.limit,
      );
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

  findById(id: number): Project | null {
    const row = this.dbs.db
      .prepare<
        [number],
        ProjectEntity
      >('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
      .get(id);
    return row ? ProjectMapper.toDomain(row) : null;
  }

  findByPath(path: string): Project | null {
    const row = this.dbs.db
      .prepare<
        [string],
        ProjectEntity
      >('SELECT * FROM projects WHERE path = ? AND deleted_at IS NULL')
      .get(path);
    return row ? ProjectMapper.toDomain(row) : null;
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
        'INSERT INTO plots (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run(projectId, payload.plotContent, payload.now, payload.now);
    });
    tx.immediate();
    if (conflict) return { ok: false, reason: 'project_exists' };
    const created = this.findByPath(payload.path);
    if (!created) {
      throw new Error(`project ${payload.path} not found after insert`);
    }
    return { ok: true, project: created };
  }

  update(id: number, patch: ProjectUpdatePatch): Project {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      sets.push('name = ?');
      params.push(patch.name);
    }
    sets.push('updated_at = ?');
    params.push(patch.updatedAt);
    params.push(id);
    this.dbs.db
      .prepare(
        `UPDATE projects SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(...params);
    const updated = this.findById(id);
    if (!updated) {
      throw new Error(`project ${id} not found after update`);
    }
    return updated;
  }

  remove(id: number): { cascadedAgents: number } {
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
