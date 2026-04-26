import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from './db.service';
import type {
  AgentCreateInput,
  AgentFull,
  AgentRow,
  AgentUpdateInput,
} from './types';

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

export class AgentServiceError extends Error {
  constructor(
    public readonly reason:
      | 'slug_conflict'
      | 'invalid_slug'
      | 'not_found'
      | 'invalid_transition'
      | 'missing_merged_commit'
      | 'invalid_merged_commit'
      | 'missing_abandoned_reason'
      | 'no_change'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`agent operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'AgentServiceError';
  }
}

function rowToFull(row: AgentRow): AgentFull {
  return {
    projectPath: row.project_path,
    slug: row.slug,
    status: row.status,
    branch: row.branch,
    worktree: row.worktree,
    reservedPaths: JSON.parse(row.reserved_paths_json) as string[],
    request: row.request,
    plan: row.plan,
    implPrompt: row.impl_prompt,
    coordinationBrief: row.coordination_brief,
    postMergeNotes: row.post_merge_notes,
    createdAt: row.created_at,
    dispatchedAt: row.dispatched_at,
    updatedAt: row.updated_at,
    mergedAt: row.merged_at,
    mergedCommit: row.merged_commit,
    abandonedReason: row.abandoned_reason,
  };
}

@Injectable()
export class AgentService {
  constructor(private readonly dbService: OrchestratorDbService) {}

  private assertProjectExistsInline(projectPath: string): void {
    const row = this.dbService.db
      .prepare<
        [string],
        { _: number }
      >('SELECT 1 AS _ FROM projects WHERE path = ?')
      .get(projectPath);
    if (!row) throw new AgentServiceError('project_not_found', projectPath);
  }

  list(projectPath: string): AgentFull[] {
    this.assertProjectExistsInline(projectPath);
    const rows = this.dbService.db
      .prepare<
        [string],
        AgentRow
      >('SELECT * FROM agents WHERE project_path = ? ORDER BY created_at DESC')
      .all(projectPath);
    return rows.map(rowToFull);
  }

  get(projectPath: string, slug: string): AgentFull | null {
    this.assertProjectExistsInline(projectPath);
    const row = this.dbService.db
      .prepare<
        [string, string],
        AgentRow
      >('SELECT * FROM agents WHERE project_path = ? AND slug = ?')
      .get(projectPath, slug);
    return row ? rowToFull(row) : null;
  }

  create(projectPath: string, input: AgentCreateInput): AgentFull {
    this.assertProjectExistsInline(projectPath);
    if (!SLUG_RE.test(input.slug)) {
      throw new AgentServiceError('invalid_slug', input.slug);
    }
    const now = Date.now();
    const reservedPathsJson = JSON.stringify(input.reservedPaths ?? []);
    try {
      this.dbService.db
        .prepare(
          `INSERT INTO agents (
             project_path, slug, status, branch, worktree, reserved_paths_json,
             request, plan, impl_prompt, coordination_brief, post_merge_notes,
             created_at, updated_at
           ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
        )
        .run(
          projectPath,
          input.slug,
          input.branch,
          input.worktree,
          reservedPathsJson,
          input.request,
          input.plan,
          input.implPrompt,
          input.coordinationBrief,
          now,
          now,
        );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        throw new AgentServiceError('slug_conflict', input.slug);
      }
      throw err;
    }
    const created = this.get(projectPath, input.slug);
    if (!created) throw new AgentServiceError('not_found', input.slug);
    return created;
  }

  update(
    projectPath: string,
    slug: string,
    patch: Omit<AgentUpdateInput, 'slug'>,
  ): AgentFull {
    this.assertProjectExistsInline(projectPath);
    const existing = this.get(projectPath, slug);
    if (!existing) throw new AgentServiceError('not_found', slug);

    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (patch.status !== undefined && patch.status !== existing.status) {
      const allowed =
        (existing.status === 'draft' && patch.status === 'active') ||
        (existing.status === 'active' &&
          (patch.status === 'merged' || patch.status === 'abandoned'));
      if (!allowed) {
        throw new AgentServiceError(
          'invalid_transition',
          `${existing.status} -> ${patch.status}`,
        );
      }
      sets.push('status = ?');
      params.push(patch.status);
      if (patch.status === 'active' && existing.dispatchedAt === null) {
        sets.push('dispatched_at = ?');
        params.push(now);
      }
      if (patch.status === 'merged') {
        if (!patch.mergedCommit)
          throw new AgentServiceError('missing_merged_commit');
        if (patch.mergedCommit.length < 7) {
          throw new AgentServiceError(
            'invalid_merged_commit',
            patch.mergedCommit,
          );
        }
        sets.push('merged_at = ?');
        params.push(now);
        sets.push('merged_commit = ?');
        params.push(patch.mergedCommit);
      }
      if (patch.status === 'abandoned') {
        if (!patch.abandonedReason)
          throw new AgentServiceError('missing_abandoned_reason');
        sets.push('abandoned_reason = ?');
        params.push(patch.abandonedReason);
      }
    } else if (patch.mergedCommit && existing.status === 'merged') {
      if (patch.mergedCommit.length < 7) {
        throw new AgentServiceError(
          'invalid_merged_commit',
          patch.mergedCommit,
        );
      }
      sets.push('merged_commit = ?');
      params.push(patch.mergedCommit);
    }

    if (patch.reservedPaths !== undefined) {
      sets.push('reserved_paths_json = ?');
      params.push(JSON.stringify(patch.reservedPaths));
    }
    if (patch.postMergeNotes !== undefined) {
      sets.push('post_merge_notes = ?');
      params.push(patch.postMergeNotes);
    }

    if (sets.length === 1) throw new AgentServiceError('no_change', slug);

    params.push(projectPath, slug);
    this.dbService.db
      .prepare(
        `UPDATE agents SET ${sets.join(', ')} WHERE project_path = ? AND slug = ?`,
      )
      .run(...params);

    const updated = this.get(projectPath, slug);
    if (!updated) throw new AgentServiceError('not_found', slug);
    return updated;
  }
}
