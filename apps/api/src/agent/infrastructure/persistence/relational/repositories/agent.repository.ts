import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Agent } from '../../../../domain/agent';
import {
  AgentCreatePayload,
  AgentCreateResult,
  AgentMigrationPayload,
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

  list(projectId: number): Agent[] {
    const rows = this.dbs.db
      .prepare<
        [number],
        AgentEntity
      >(
        'SELECT * FROM agents WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      )
      .all(projectId);
    return rows.map((r) => AgentMapper.toDomain(r));
  }

  findBySlug(projectId: number, slug: string): Agent | null {
    const row = this.dbs.db
      .prepare<
        [number, string],
        AgentEntity
      >(
        'SELECT * FROM agents WHERE project_id = ? AND slug = ? AND deleted_at IS NULL',
      )
      .get(projectId, slug);
    return row ? AgentMapper.toDomain(row) : null;
  }

  create(projectId: number, payload: AgentCreatePayload): AgentCreateResult {
    try {
      this.dbs.db
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        return { ok: false, reason: 'slug_conflict' };
      }
      throw err;
    }
    const created = this.findBySlug(projectId, payload.slug);
    if (!created) {
      throw new Error(
        `agent ${payload.slug} not found after insert (project_id=${projectId})`,
      );
    }
    return { ok: true, agent: created };
  }

  update(projectId: number, slug: string, patch: AgentUpdatePatch): void {
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

    params.push(projectId, slug);
    this.dbs.db
      .prepare(
        `UPDATE agents SET ${sets.join(', ')} WHERE project_id = ? AND slug = ?`,
      )
      .run(...params);
  }

  upsertFromMigration(
    projectId: number,
    slug: string,
    payload: AgentMigrationPayload,
  ): void {
    const existing = this.dbs.db
      .prepare<
        [number, string],
        { created_at: number }
      >('SELECT created_at FROM agents WHERE project_id = ? AND slug = ?')
      .get(projectId, slug);

    this.dbs.db
      .prepare(
        `
      INSERT INTO agents (
        project_id, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, dispatched_at, updated_at, merged_at, merged_commit, abandoned_reason
      ) VALUES (
        @project_id, @slug, @status, @branch, @worktree, @reserved_paths_json,
        @request, @plan, @impl_prompt, @coordination_brief, @post_merge_notes,
        @created_at, @dispatched_at, @updated_at, @merged_at, @merged_commit, @abandoned_reason
      )
      ON CONFLICT(project_id, slug) DO UPDATE SET
        status = excluded.status,
        branch = excluded.branch,
        worktree = excluded.worktree,
        reserved_paths_json = excluded.reserved_paths_json,
        request = excluded.request,
        plan = excluded.plan,
        impl_prompt = excluded.impl_prompt,
        coordination_brief = excluded.coordination_brief,
        post_merge_notes = excluded.post_merge_notes,
        dispatched_at = excluded.dispatched_at,
        updated_at = excluded.updated_at,
        merged_at = excluded.merged_at,
        merged_commit = excluded.merged_commit,
        abandoned_reason = excluded.abandoned_reason
    `,
      )
      .run({
        project_id: projectId,
        slug,
        status: payload.status,
        branch: payload.branch,
        worktree: payload.worktree,
        reserved_paths_json: JSON.stringify(payload.reservedPaths),
        request: payload.request,
        plan: payload.plan,
        impl_prompt: payload.implPrompt,
        coordination_brief: payload.coordinationBrief,
        post_merge_notes: payload.postMergeNotes,
        created_at: existing?.created_at ?? payload.dispatchedAt ?? payload.now,
        dispatched_at: payload.dispatchedAt,
        updated_at: payload.now,
        merged_at: payload.mergedAt,
        merged_commit: payload.mergedCommit,
        abandoned_reason: null,
      });
  }
}
