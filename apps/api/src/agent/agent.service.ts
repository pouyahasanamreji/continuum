import { Injectable } from '@nestjs/common';
import { Agent } from './domain/agent';
import { AgentServiceError } from '../common/errors/service-errors';
import { SLUG_RE } from '../common/slug';
import {
  AgentMigrationPayload,
  AgentRepository,
  AgentUpdatePatch,
} from './infrastructure/persistence/agent.repository';
import { OrchestratorDbService } from '../database/orchestrator-db.service';

interface AgentCreateInput {
  slug: string;
  branch: string;
  worktree: string;
  reservedPaths?: string[];
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
}

interface AgentUpdateInput {
  status?: 'active' | 'merged' | 'abandoned';
  reservedPaths?: string[];
  postMergeNotes?: string;
  mergedCommit?: string;
  abandonedReason?: string;
}

@Injectable()
export class AgentService {
  constructor(
    private readonly repo: AgentRepository,
    private readonly dbs: OrchestratorDbService,
  ) {}

  private resolveProjectIdInline(projectPath: string): number {
    const row = this.dbs.db
      .prepare<
        [string],
        { id: number }
      >(
        'SELECT id FROM projects WHERE path = ? AND deleted_at IS NULL',
      )
      .get(projectPath);
    if (!row) throw new AgentServiceError('project_not_found', projectPath);
    return row.id;
  }

  list(projectPath: string): Agent[] {
    const projectId = this.resolveProjectIdInline(projectPath);
    return this.repo.list(projectId);
  }

  get(projectPath: string, slug: string): Agent | null {
    const projectId = this.resolveProjectIdInline(projectPath);
    return this.repo.findBySlug(projectId, slug);
  }

  create(projectPath: string, input: AgentCreateInput): Agent {
    const projectId = this.resolveProjectIdInline(projectPath);
    if (!SLUG_RE.test(input.slug)) {
      throw new AgentServiceError('invalid_slug', input.slug);
    }
    const result = this.repo.create(projectId, {
      slug: input.slug,
      branch: input.branch,
      worktree: input.worktree,
      reservedPaths: input.reservedPaths ?? [],
      request: input.request,
      plan: input.plan,
      implPrompt: input.implPrompt,
      coordinationBrief: input.coordinationBrief,
      now: Date.now(),
    });
    if (!result.ok) {
      throw new AgentServiceError('slug_conflict', input.slug);
    }
    return result.agent;
  }

  update(projectPath: string, slug: string, patch: AgentUpdateInput): Agent {
    const projectId = this.resolveProjectIdInline(projectPath);
    const existing = this.repo.findBySlug(projectId, slug);
    if (!existing) throw new AgentServiceError('not_found', slug);

    const now = Date.now();
    const out: AgentUpdatePatch = { updatedAt: now };
    let touched = false;

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
      out.status = patch.status;
      touched = true;
      if (patch.status === 'active' && existing.dispatchedAt === null) {
        out.dispatchedAt = now;
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
        out.mergedAt = now;
        out.mergedCommit = patch.mergedCommit;
      }
      if (patch.status === 'abandoned') {
        if (!patch.abandonedReason)
          throw new AgentServiceError('missing_abandoned_reason');
        out.abandonedReason = patch.abandonedReason;
      }
    } else if (patch.mergedCommit && existing.status === 'merged') {
      if (patch.mergedCommit.length < 7) {
        throw new AgentServiceError(
          'invalid_merged_commit',
          patch.mergedCommit,
        );
      }
      out.mergedCommit = patch.mergedCommit;
      touched = true;
    }

    if (patch.reservedPaths !== undefined) {
      out.reservedPaths = patch.reservedPaths;
      touched = true;
    }
    if (patch.postMergeNotes !== undefined) {
      out.postMergeNotes = patch.postMergeNotes;
      touched = true;
    }

    if (!touched) throw new AgentServiceError('no_change', slug);

    this.repo.update(projectId, slug, out);
    const updated = this.repo.findBySlug(projectId, slug);
    if (!updated) throw new AgentServiceError('not_found', slug);
    return updated;
  }

  upsertFromMigration(
    projectPath: string,
    slug: string,
    payload: AgentMigrationPayload,
  ): void {
    const projectId = this.resolveProjectIdInline(projectPath);
    this.repo.upsertFromMigration(projectId, slug, payload);
  }
}
