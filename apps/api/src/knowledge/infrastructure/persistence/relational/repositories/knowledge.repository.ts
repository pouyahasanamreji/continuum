// Hard-delete; cascade-safe (no child tables). Soft-delete deferred — same
// status as project module per `project-module-cleanup` lesson #7.
import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { KnowledgeKindEnum } from '../../../../../knowledge-kinds/knowledge-kinds.enum';
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
  kind: 'kind',
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
    if (f?.kind !== undefined && f?.kind !== null) {
      where.push('kind = ?');
      params.push(f.kind);
    }
    if (f?.q !== undefined && f?.q !== null && f.q !== '') {
      where.push('(slug LIKE ? OR content LIKE ?)');
      params.push(`%${f.q}%`, `%${f.q}%`);
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
             project_id, agent_id, slug, content, kind, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          payload.agentId,
          payload.slug,
          payload.content,
          payload.kind,
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
    if (patch.kind !== undefined) {
      sets.push('kind = ?');
      params.push(patch.kind);
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

  findAllForVectorize(
    mode: 'missing' | 'all',
    signature?: string,
  ): Array<{ id: number; content: string }> {
    if (mode === 'all') {
      return this.dbs.db
        .prepare(
          `SELECT id, content FROM knowledge WHERE deleted_at IS NULL ORDER BY id ASC`,
        )
        .all() as Array<{ id: number; content: string }>;
    }
    if (!signature) {
      return this.dbs.db
        .prepare(
          `SELECT id, content FROM knowledge WHERE deleted_at IS NULL ORDER BY id ASC`,
        )
        .all() as Array<{ id: number; content: string }>;
    }
    // mode 'missing': WHERE NOT EXISTS instead of LEFT JOIN — friendlier if
    // knowledge_vec is mid-recreate.
    return this.dbs.db
      .prepare(
        `SELECT id, content FROM knowledge
         WHERE deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM knowledge_vec
             WHERE knowledge_vec.knowledge_id = knowledge.id
               AND knowledge_vec.embedder_signature = ?
           )
         ORDER BY id ASC`,
      )
      .all(signature) as Array<{ id: number; content: string }>;
  }

  // Plain LIKE %query%; ASCII case-insensitive only. % and _ in query act as
  // wildcards — caller-managed footgun. No FTS5.
  searchByContent(
    projectId: number,
    query: string | undefined,
    kind: KnowledgeKindEnum | undefined,
    limit: number,
  ): Knowledge[] {
    const where: string[] = ['project_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [projectId];
    if (query !== undefined) {
      const pattern = `%${query}%`;
      where.push('(content LIKE ? OR slug LIKE ?)');
      params.push(pattern, pattern);
    }
    if (kind !== undefined) {
      where.push('kind = ?');
      params.push(kind);
    }
    const sql =
      `SELECT * FROM knowledge WHERE ${where.join(' AND ')} ` +
      `ORDER BY created_at DESC, id ASC LIMIT ?`;
    params.push(limit);
    const rows = this.dbs.db
      .prepare<(string | number)[], KnowledgeEntity>(sql)
      .all(...params);
    return rows.map((r) => KnowledgeMapper.toDomain(r));
  }

  // vec0 default distance metric is L2; embedder vectors are L2-normalized
  // so L2 ranking is cosine-equivalent. Distance is internal — caller gets Knowledge[].
  searchByVector(
    projectId: number,
    queryEmbedding: number[],
    kind: KnowledgeKindEnum | undefined,
    limit: number,
    signature: string,
  ): Knowledge[] {
    // Overfetch from vec0 because top-K runs BEFORE the post-JOIN project/kind filter.
    const K_VEC = Math.min(200, Math.max(50, limit * 5 + 20));
    const buf = Buffer.from(new Float32Array(queryEmbedding).buffer);
    const where: string[] = [
      'kv.embedding MATCH ?',
      'kv.k = ?',
      'kv.embedder_signature = ?',
      'k.project_id = ?',
      'k.deleted_at IS NULL',
    ];
    const params: (Buffer | number | string)[] = [
      buf,
      K_VEC,
      signature,
      projectId,
    ];
    if (kind !== undefined) {
      where.push('k.kind = ?');
      params.push(kind);
    }
    const sql =
      `SELECT k.* FROM knowledge_vec kv ` +
      `JOIN knowledge k ON k.id = kv.knowledge_id ` +
      `WHERE ${where.join(' AND ')} ` +
      `ORDER BY kv.distance ` +
      `LIMIT ?`;
    params.push(limit);
    const rows = this.dbs.db
      .prepare<(Buffer | number | string)[], KnowledgeEntity>(sql)
      .all(...params);
    return rows.map((r) => KnowledgeMapper.toDomain(r));
  }

  countFreshForSearch(
    projectId: number,
    kind: KnowledgeKindEnum | undefined,
    signature: string,
  ): number {
    const where: string[] = [
      'k.project_id = ?',
      'k.deleted_at IS NULL',
      'kv.embedder_signature = ?',
    ];
    const params: (number | string)[] = [projectId, signature];
    if (kind !== undefined) {
      where.push('k.kind = ?');
      params.push(kind);
    }
    const row = this.dbs.db
      .prepare<(number | string)[], { c: number }>(
        `SELECT COUNT(*) AS c FROM knowledge k
         JOIN knowledge_vec kv ON kv.knowledge_id = k.id
         WHERE ${where.join(' AND ')}`,
      )
      .get(...params);
    return row?.c ?? 0;
  }
}
