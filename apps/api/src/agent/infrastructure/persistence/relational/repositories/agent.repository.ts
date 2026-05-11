import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Agent } from '../../../../domain/agent';
import { AgentSummary } from '../../../../domain/agent-summary';
import {
  AgentCreatePayload,
  AgentCreateResult,
  AgentFindManyOptions,
  AgentListOptions,
  AgentRepository,
  AgentUpdatePatch,
} from '../../agent.repository';
import { AgentEntity } from '../entities/agent.entity';
import { AgentMapper } from '../mappers/agent.mapper';

@Injectable()
export class AgentRelationalRepository extends AgentRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  findAll(projectId: number, options?: AgentListOptions): AgentSummary[] {
    const where: string[] = ['project_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [projectId];
    if (options?.status !== undefined) {
      where.push('status = ?');
      params.push(options.status);
    }
    const sql =
      `SELECT * FROM agents WHERE ${where.join(' AND ')} ` +
      `ORDER BY created_at DESC`;
    const rows = this.dbs.db
      .prepare<(string | number)[], AgentEntity>(sql)
      .all(...params);
    return rows.map((r) => AgentMapper.toSummary(r));
  }

  findManyWithPagination(
    projectId: number,
    options: AgentFindManyOptions,
  ): AgentSummary[] {
    const where: string[] = ['project_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [projectId];
    if (options.status !== undefined) {
      where.push('status = ?');
      params.push(options.status);
    }
    const sql =
      `SELECT * FROM agents WHERE ${where.join(' AND ')} ` +
      `ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const rows = this.dbs.db
      .prepare<(string | number)[], AgentEntity>(sql)
      .all(...params, options.limit, (options.page - 1) * options.limit);
    return rows.map((r) => AgentMapper.toSummary(r));
  }

  findById(id: number): Agent | null {
    const row = this.dbs.db
      .prepare<
        [number],
        AgentEntity
      >('SELECT * FROM agents WHERE id = ? AND deleted_at IS NULL')
      .get(id);
    return row ? AgentMapper.toDomain(row) : null;
  }

  findByProjectIdAndSlug(projectId: number, slug: string): Agent | null {
    const row = this.dbs.db
      .prepare<
        [number, string],
        AgentEntity
      >('SELECT * FROM agents WHERE project_id = ? AND slug = ? AND deleted_at IS NULL')
      .get(projectId, slug);
    return row ? AgentMapper.toDomain(row) : null;
  }

  create(projectId: number, payload: AgentCreatePayload): AgentCreateResult {
    let agentId: number | null = null;
    try {
      const info = this.dbs.db
        .prepare(
          `INSERT INTO agents (
             project_id, slug, status, branch, worktree, reserved_paths_json,
             request, plan, impl_prompt, coordination_brief, post_merge_notes,
             created_at, updated_at
           ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
        )
        .run(
          projectId,
          payload.slug,
          payload.branch,
          payload.worktree,
          JSON.stringify(payload.reservedPaths),
          payload.request,
          payload.plan,
          payload.implPrompt,
          payload.coordinationBrief,
          payload.now,
          payload.now,
        );
      agentId = Number(info.lastInsertRowid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        return { ok: false, reason: 'slug_conflict' };
      }
      throw err;
    }
    const created = this.findById(agentId);
    if (!created) {
      throw new Error(
        `agent ${payload.slug} not found after insert (project_id=${projectId})`,
      );
    }
    return { ok: true, agent: created };
  }

  update(id: number, patch: AgentUpdatePatch): void {
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [patch.updatedAt];

    if (patch.status !== undefined) {
      sets.push('status = ?');
      params.push(patch.status);
    }
    if (patch.dispatchedAt !== undefined) {
      sets.push('dispatched_at = ?');
      params.push(patch.dispatchedAt);
    }
    if (patch.mergedAt !== undefined) {
      sets.push('merged_at = ?');
      params.push(patch.mergedAt);
    }
    if (patch.mergedCommit !== undefined) {
      sets.push('merged_commit = ?');
      params.push(patch.mergedCommit);
    }
    if (patch.abandonedReason !== undefined) {
      sets.push('abandoned_reason = ?');
      params.push(patch.abandonedReason);
    }
    if (patch.reservedPaths !== undefined) {
      sets.push('reserved_paths_json = ?');
      params.push(JSON.stringify(patch.reservedPaths));
    }
    if (patch.postMergeNotes !== undefined) {
      sets.push('post_merge_notes = ?');
      params.push(patch.postMergeNotes);
    }
    if (patch.plan !== undefined) {
      sets.push('plan = ?');
      params.push(patch.plan);
    }
    if (patch.implPrompt !== undefined) {
      sets.push('impl_prompt = ?');
      params.push(patch.implPrompt);
    }
    if (patch.coordinationBrief !== undefined) {
      sets.push('coordination_brief = ?');
      params.push(patch.coordinationBrief);
    }

    params.push(id);
    this.dbs.db
      .prepare(
        `UPDATE agents SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(...params);
  }
}
