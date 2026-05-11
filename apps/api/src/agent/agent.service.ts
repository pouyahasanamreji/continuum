import { Injectable } from '@nestjs/common';
import { Agent } from './domain/agent';
import { AgentSummary } from './domain/agent-summary';
import { AgentStatusEnum } from '../agent-statuses/agent-statuses.enum';
import { AgentServiceError } from '../common/errors/service-errors';
import { SLUG_RE } from '../common/slug';
import {
  AgentRepository,
  AgentUpdatePatch,
} from './infrastructure/persistence/agent.repository';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';

@Injectable()
export class AgentService {
  constructor(
    private readonly repo: AgentRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  private resolveProjectIdOrThrow(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new AgentServiceError('project_not_found', projectPath);
    }
    return id;
  }

  list(projectPath: string, status?: AgentStatusEnum): AgentSummary[] {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findAll(projectId, status ? { status } : undefined);
  }

  findManyWithPagination(queryAgentDto: QueryAgentDto): AgentSummary[] {
    const projectId = this.resolveProjectIdOrThrow(queryAgentDto.project);
    return this.repo.findManyWithPagination(projectId, {
      page: queryAgentDto.page ?? 1,
      limit: queryAgentDto.limit ?? 10,
      status: queryAgentDto.filters?.status ?? undefined,
    });
  }

  get(projectPath: string, slug: string): Agent | null {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findByProjectIdAndSlug(projectId, slug);
  }

  create(createAgentDto: CreateAgentDto): Agent {
    const projectId = this.resolveProjectIdOrThrow(createAgentDto.project);
    if (!SLUG_RE.test(createAgentDto.slug)) {
      throw new AgentServiceError('invalid_slug', createAgentDto.slug);
    }
    const result = this.repo.create(projectId, {
      slug: createAgentDto.slug,
      branch: createAgentDto.branch,
      worktree: createAgentDto.worktree,
      reservedPaths: createAgentDto.reservedPaths ?? [],
      request: createAgentDto.request,
      plan: createAgentDto.plan,
      implPrompt: createAgentDto.implPrompt,
      coordinationBrief: createAgentDto.coordinationBrief,
      now: Date.now(),
    });
    if (!result.ok) {
      throw new AgentServiceError('slug_conflict', createAgentDto.slug);
    }
    return result.agent;
  }

  update(slug: string, updateAgentDto: UpdateAgentDto): Agent {
    const projectId = this.resolveProjectIdOrThrow(updateAgentDto.project);
    const existing = this.repo.findByProjectIdAndSlug(projectId, slug);
    if (!existing) throw new AgentServiceError('not_found', slug);

    const now = Date.now();
    const out: AgentUpdatePatch = { updatedAt: now };
    let touched = false;

    if (
      updateAgentDto.status !== undefined &&
      updateAgentDto.status !== existing.status
    ) {
      const allowed =
        (existing.status === 'draft' && updateAgentDto.status === 'active') ||
        (existing.status === 'active' &&
          (updateAgentDto.status === 'merged' ||
            updateAgentDto.status === 'abandoned'));
      if (!allowed) {
        throw new AgentServiceError(
          'invalid_transition',
          `${existing.status} -> ${updateAgentDto.status}`,
        );
      }
      out.status = updateAgentDto.status;
      touched = true;
      if (
        updateAgentDto.status === 'active' &&
        existing.dispatchedAt === null
      ) {
        out.dispatchedAt = now;
      }
      if (updateAgentDto.status === 'merged') {
        if (!updateAgentDto.mergedCommit)
          throw new AgentServiceError('missing_merged_commit');
        if (updateAgentDto.mergedCommit.length < 7) {
          throw new AgentServiceError(
            'invalid_merged_commit',
            updateAgentDto.mergedCommit,
          );
        }
        out.mergedAt = now;
        out.mergedCommit = updateAgentDto.mergedCommit;
      }
      if (updateAgentDto.status === 'abandoned') {
        if (!updateAgentDto.abandonedReason)
          throw new AgentServiceError('missing_abandoned_reason');
        out.abandonedReason = updateAgentDto.abandonedReason;
      }
    } else if (updateAgentDto.mergedCommit && existing.status === 'merged') {
      if (updateAgentDto.mergedCommit.length < 7) {
        throw new AgentServiceError(
          'invalid_merged_commit',
          updateAgentDto.mergedCommit,
        );
      }
      out.mergedCommit = updateAgentDto.mergedCommit;
      touched = true;
    }

    if (updateAgentDto.reservedPaths !== undefined) {
      out.reservedPaths = updateAgentDto.reservedPaths;
      touched = true;
    }
    if (updateAgentDto.postMergeNotes !== undefined) {
      out.postMergeNotes = updateAgentDto.postMergeNotes;
      touched = true;
    }

    const wantsArtifactEdit =
      updateAgentDto.plan !== undefined ||
      updateAgentDto.implPrompt !== undefined ||
      updateAgentDto.coordinationBrief !== undefined;

    if (wantsArtifactEdit) {
      const effectiveStatus = out.status ?? existing.status;
      if (effectiveStatus !== 'draft' && effectiveStatus !== 'active') {
        throw new AgentServiceError(
          'artifacts_frozen',
          `status=${effectiveStatus}`,
        );
      }
      if (updateAgentDto.plan !== undefined) {
        out.plan = updateAgentDto.plan;
        touched = true;
      }
      if (updateAgentDto.implPrompt !== undefined) {
        out.implPrompt = updateAgentDto.implPrompt;
        touched = true;
      }
      if (updateAgentDto.coordinationBrief !== undefined) {
        out.coordinationBrief = updateAgentDto.coordinationBrief;
        touched = true;
      }
    }

    if (!touched) throw new AgentServiceError('no_change', slug);

    this.repo.update(existing.id, out);
    const updated = this.repo.findById(existing.id);
    if (!updated) throw new AgentServiceError('not_found', slug);
    return updated;
  }
}
