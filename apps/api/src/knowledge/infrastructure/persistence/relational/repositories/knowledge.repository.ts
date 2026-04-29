// Hard-delete; cascade-safe (no child tables). Soft-delete deferred — same
// status as project module per `project-module-cleanup` lesson #7.
import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Knowledge } from '../../../../domain/knowledge';
import {
  KnowledgeCreatePayload,
  KnowledgeCreateResult,
  KnowledgeFindManyOptions,
  KnowledgeRepository,
  KnowledgeUpdatePatch,
} from '../../knowledge.repository';
import { KnowledgeEntity } from '../entities/knowledge.entity';
import { KnowledgeMapper } from '../mappers/knowledge.mapper';

const ORDER_COLUMNS = {
  id: 'id',
  slug: 'slug',
  agentId: 'agent_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

@Injectable()
export class KnowledgeRelationalRepository extends KnowledgeRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  findAll(projectId: number): Knowledge[] {
    const rows = this.dbs.db
      .prepare<
        [number],
        KnowledgeEntity
      >('SELECT * FROM knowledge WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id ASC')
      .all(projectId);
    return rows.map((r) => KnowledgeMapper.toDomain(r));
  }

  findManyWithPagination(
    projectId: number,
    options: KnowledgeFindManyOptions,
  ): Knowledge[] {
    const where: string[] = ['project_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [projectId];
    const f = options.filterOptions;
    if (f?.agentId !== undefined && f?.agentId !== null) {
      where.push('agent_id = ?');
      params.push(f.agentId);
    }
    if (f?.slug !== undefined && f?.slug !== null && f.slug !== '') {
      where.push('slug LIKE ?');
      params.push(`%${f.slug}%`);
    }

    const orderClauses: string[] = [];
    if (options.sortOptions?.length) {
      for (const s of options.sortOptions) {
        if (!Object.hasOwn(ORDER_COLUMNS, s.orderBy)) continue;
        const dir = (s.order ?? '').toUpperCase();
        if (dir !== 'ASC' && dir !== 'DESC') continue;
        const col = ORDER_COLUMNS[s.orderBy as keyof typeof ORDER_COLUMNS];
        orderClauses.push(`${col} ${dir}`);
      }
    }
    const orderBy =
      orderClauses.length > 0 ? orderClauses.join(', ') : 'id DESC';

    const sql = `SELECT * FROM knowledge WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const rows = this.dbs.db
      .prepare<(string | number)[], KnowledgeEntity>(sql)
      .all(
        ...params,
        options.paginationOptions.limit,
        (options.paginationOptions.page - 1) * options.paginationOptions.limit,
      );
    return rows.map((r) => KnowledgeMapper.toDomain(r));
  }

  findById(id: number): Knowledge | null {
    const row = this.dbs.db
      .prepare<
        [number],
        KnowledgeEntity
      >('SELECT * FROM knowledge WHERE id = ? AND deleted_at IS NULL')
      .get(id);
    return row ? KnowledgeMapper.toDomain(row) : null;
  }

  findByProjectIdAndSlug(projectId: number, slug: string): Knowledge | null {
    const row = this.dbs.db
      .prepare<
        [number, string],
        KnowledgeEntity
      >('SELECT * FROM knowledge WHERE project_id = ? AND slug = ? AND deleted_at IS NULL')
      .get(projectId, slug);
    return row ? KnowledgeMapper.toDomain(row) : null;
  }

  create(
    projectId: number,
    payload: KnowledgeCreatePayload,
  ): KnowledgeCreateResult {
    let id: number | null = null;
    try {
      const info = this.dbs.db
        .prepare(
          `INSERT INTO knowledge (
             project_id, agent_id, slug, content, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          payload.agentId,
          payload.slug,
          payload.content,
          payload.now,
          payload.now,
        );
      id = Number(info.lastInsertRowid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        return { ok: false, reason: 'slug_conflict' };
      }
      throw err;
    }
    const created = this.findById(id);
    if (!created) {
      throw new Error(
        `knowledge ${payload.slug} not found after insert (project_id=${projectId})`,
      );
    }
    return { ok: true, knowledge: created };
  }

  update(id: number, patch: KnowledgeUpdatePatch): void {
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [patch.updatedAt];

    if (patch.agentId !== undefined) {
      sets.push('agent_id = ?');
      params.push(patch.agentId);
    }
    if (patch.content !== undefined) {
      sets.push('content = ?');
      params.push(patch.content);
    }

    params.push(id);
    this.dbs.db
      .prepare(
        `UPDATE knowledge SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(...params);
  }

  remove(id: number): void {
    this.dbs.db.prepare('DELETE FROM knowledge WHERE id = ?').run(id);
  }

  // Plain LIKE %query%; ASCII case-insensitive only. % and _ in query act as
  // wildcards — caller-managed footgun. No FTS5.
  searchByContent(
    projectId: number,
    query: string,
    limit: number,
  ): Knowledge[] {
    const pattern = `%${query}%`;
    const rows = this.dbs.db
      .prepare<[number, string, string, number], KnowledgeEntity>(
        `SELECT * FROM knowledge
         WHERE project_id = ? AND deleted_at IS NULL
           AND (content LIKE ? OR slug LIKE ?)
         ORDER BY created_at DESC, id ASC
         LIMIT ?`,
      )
      .all(projectId, pattern, pattern, limit);
    return rows.map((r) => KnowledgeMapper.toDomain(r));
  }
}
