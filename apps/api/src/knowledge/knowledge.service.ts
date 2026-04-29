import { Injectable, Logger } from '@nestjs/common';
import { Knowledge } from './domain/knowledge';
import { KnowledgeServiceError } from '../common/errors/service-errors';
import { SLUG_RE } from '../common/slug';
import { KnowledgeKindEnum } from '../knowledge-kinds/knowledge-kinds.enum';
import {
  KnowledgeRepository,
  KnowledgeUpdatePatch,
} from './infrastructure/persistence/knowledge.repository';
import { KnowledgeVectorRepository } from './infrastructure/persistence/knowledge-vector.repository';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { AgentRepository } from '../agent/infrastructure/persistence/agent.repository';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { EmbedderService } from '../embedder/embedder.service';
import { EmbedderError } from '../embedder/embedder.error';

const SEARCH_DEFAULT_LIMIT = 10;
const SEARCH_MAX_LIMIT = 50;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly agentRepo: AgentRepository,
    private readonly embedder: EmbedderService,
    private readonly vecRepo: KnowledgeVectorRepository,
  ) {}

  private resolveProjectIdOrThrow(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new KnowledgeServiceError('project_not_found', projectPath);
    }
    return id;
  }

  private resolveAgentIdOrThrow(projectId: number, agentSlug: string): number {
    const agent = this.agentRepo.findByProjectIdAndSlug(projectId, agentSlug);
    if (!agent) {
      throw new KnowledgeServiceError('agent_not_found', agentSlug);
    }
    return agent.id;
  }

  list(projectPath: string): Knowledge[] {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findAll(projectId);
  }

  findManyWithPagination(query: QueryKnowledgeDto): Knowledge[] {
    const projectId = this.resolveProjectIdOrThrow(query.project);
    const filters = query.filters ?? null;
    let agentId: number | null = null;
    if (filters?.agentSlug) {
      const agent = this.agentRepo.findByProjectIdAndSlug(
        projectId,
        filters.agentSlug,
      );
      if (!agent) return [];
      agentId = agent.id;
    }
    return this.repo.findManyWithPagination(projectId, {
      filterOptions: {
        agentId,
        slug: filters?.slug ?? null,
        kind: filters?.kind ?? null,
      },
      sortOptions: query.sort ?? null,
      paginationOptions: { page: query.page ?? 1, limit: query.limit ?? 10 },
    });
  }

  get(projectPath: string, slug: string): Knowledge | null {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findByProjectIdAndSlug(projectId, slug);
  }

  async create(dto: CreateKnowledgeDto): Promise<Knowledge> {
    const projectId = this.resolveProjectIdOrThrow(dto.project);
    if (!SLUG_RE.test(dto.slug)) {
      throw new KnowledgeServiceError('invalid_slug', dto.slug);
    }
    if (!SLUG_RE.test(dto.agentSlug)) {
      throw new KnowledgeServiceError('invalid_slug', dto.agentSlug);
    }
    const agentId = this.resolveAgentIdOrThrow(projectId, dto.agentSlug);
    const result = this.repo.create(projectId, {
      agentId,
      slug: dto.slug,
      content: dto.content,
      kind: dto.kind ?? 'situational',
      now: Date.now(),
    });
    if (!result.ok) {
      throw new KnowledgeServiceError('slug_conflict', dto.slug);
    }
    await this.vectorize(result.knowledge.id, dto.content);
    return result.knowledge;
  }

  async update(slug: string, dto: UpdateKnowledgeDto): Promise<Knowledge> {
    const projectId = this.resolveProjectIdOrThrow(dto.project);
    const existing = this.repo.findByProjectIdAndSlug(projectId, slug);
    if (!existing) throw new KnowledgeServiceError('not_found', slug);

    const now = Date.now();
    const patch: KnowledgeUpdatePatch = { updatedAt: now };
    let touched = false;

    if (dto.agentSlug !== undefined) {
      if (!SLUG_RE.test(dto.agentSlug)) {
        throw new KnowledgeServiceError('invalid_slug', dto.agentSlug);
      }
      const agentId = this.resolveAgentIdOrThrow(projectId, dto.agentSlug);
      patch.agentId = agentId;
      touched = true;
    }
    if (dto.content !== undefined) {
      patch.content = dto.content;
      touched = true;
    }
    if (dto.kind !== undefined) {
      patch.kind = dto.kind;
      touched = true;
    }

    if (!touched) throw new KnowledgeServiceError('no_change', slug);

    this.repo.update(existing.id, patch);
    const updated = this.repo.findById(existing.id);
    if (!updated) throw new KnowledgeServiceError('not_found', slug);
    if (dto.content !== undefined) {
      await this.vectorize(updated.id, dto.content);
    }
    return updated;
  }

  remove(projectPath: string, slug: string): void {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    const existing = this.repo.findByProjectIdAndSlug(projectId, slug);
    if (!existing) throw new KnowledgeServiceError('not_found', slug);
    this.repo.remove(existing.id);
  }

  private async vectorize(knowledgeId: number, content: string): Promise<void> {
    try {
      const vec = await this.embedder.embed(content);
      this.vecRepo.upsert(knowledgeId, vec);
    } catch (err) {
      const reason = err instanceof EmbedderError ? err.reason : 'unknown';
      this.logger.warn(
        `knowledge ${knowledgeId} vectorization skipped: ${reason}` +
          (err instanceof Error ? ` (${err.message})` : ''),
      );
    }
  }

  search(
    projectPath: string,
    query: string | undefined,
    kind: KnowledgeKindEnum | undefined,
    limit?: number,
  ): Knowledge[] {
    if (query === undefined && kind === undefined) {
      throw new KnowledgeServiceError('invalid_query', 'q or kind required');
    }
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    const effectiveLimit = Math.min(
      limit ?? SEARCH_DEFAULT_LIMIT,
      SEARCH_MAX_LIMIT,
    );
    return this.repo.searchByContent(projectId, query, kind, effectiveLimit);
  }
}
