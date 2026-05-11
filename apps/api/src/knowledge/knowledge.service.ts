import { Injectable, Logger } from '@nestjs/common';
import { Knowledge } from './domain/knowledge';
import { KnowledgeSummary } from './domain/knowledge-summary';
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
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  VectorizeKnowledgeResultDto,
  VectorizeStatusDto,
} from './dto/vectorize-knowledge.dto';
import {
  EmbeddedVector,
  makeEmbedderSignature,
} from '../embedder/embedder-profile';
import { KnowledgeVectorMetadata } from './infrastructure/persistence/knowledge-vector.repository';

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
    private readonly settings: AppSettingsService,
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

  list(projectPath: string, kind?: KnowledgeKindEnum): KnowledgeSummary[] {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findAll(projectId, kind ? { kind } : undefined);
  }

  findManyWithPagination(query: QueryKnowledgeDto): KnowledgeSummary[] {
    const projectId = this.resolveProjectIdOrThrow(query.project);
    const filters = query.filters ?? null;
    const trimmedQ = query.q?.trim() ?? '';
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
        q: trimmedQ || null,
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
      const embedded = await this.embedder.embedWithProfile(content);
      this.vecRepo.upsert(
        knowledgeId,
        embedded.embedding,
        this.vectorMetadata(embedded),
      );
    } catch (err) {
      const reason = err instanceof EmbedderError ? err.reason : 'unknown';
      this.logger.warn(
        `knowledge ${knowledgeId} vectorization skipped: ${reason}` +
          (err instanceof Error ? ` (${err.message})` : ''),
      );
    }
  }

  async vectorizeAll(opts: {
    mode: 'missing' | 'all';
    targetDim?: number;
  }): Promise<VectorizeKnowledgeResultDto> {
    const start = Date.now();
    const profile = this.settings.resolveEmbedderProfile();
    if (opts.mode === 'all') {
      if (opts.targetDim !== undefined)
        this.vecRepo.recreateTable(opts.targetDim);
      else this.vecRepo.deleteAllRows();
    }
    const rows = this.repo.findAllForVectorize(
      opts.mode,
      profile.signature ?? undefined,
    );
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    for (const row of rows) {
      if (!row.content || row.content.trim() === '') {
        skipped++;
        continue;
      }
      try {
        const embedded = await this.embedder.embedWithProfile(row.content);
        this.vecRepo.upsert(
          row.id,
          embedded.embedding,
          this.vectorMetadata(embedded),
        );
        processed++;
      } catch (err) {
        errors++;
        const reason = err instanceof EmbedderError ? err.reason : 'unknown';
        this.logger.warn(
          `knowledge ${row.id} vectorizeAll skipped: ${reason}` +
            (err instanceof Error ? ` (${err.message})` : ''),
        );
      }
    }
    return { processed, skipped, errors, durationMs: Date.now() - start };
  }

  getVectorizeStatus(): VectorizeStatusDto {
    const totalKnowledge = this.repo.findAllForVectorize('all').length;
    const totalVectors = this.vecRepo.countRows();
    const currentDim = this.vecRepo.currentDim();
    const profile = this.settings.resolveEmbedderProfile();
    const fresh = profile.signature
      ? this.vecRepo.countRowsBySignature(profile.signature)
      : 0;
    const needed = Math.max(0, totalKnowledge - fresh);
    const stale = Math.max(0, totalVectors - fresh);
    return {
      totalKnowledge,
      totalVectors,
      fresh,
      missing: needed,
      needed,
      stale,
      currentDim,
      targetDim: profile.dim,
      profile,
    };
  }

  async search(
    projectPath: string,
    query: string | undefined,
    kind: KnowledgeKindEnum | undefined,
    limit?: number,
  ): Promise<KnowledgeSummary[]> {
    if (query === undefined && kind === undefined) {
      throw new KnowledgeServiceError('invalid_query', 'q or kind required');
    }
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    const effectiveLimit = Math.min(
      limit ?? SEARCH_DEFAULT_LIMIT,
      SEARCH_MAX_LIMIT,
    );
    if (query === undefined) {
      return this.repo.searchByContent(
        projectId,
        undefined,
        kind,
        effectiveLimit,
      );
    }
    const queryVec = await this.embedder.embedWithProfile(query);
    const signature = makeEmbedderSignature(queryVec.profile);
    const fresh = this.repo.countFreshForSearch(projectId, kind, signature);
    if (fresh === 0) return [];
    return this.repo.searchByVector(
      projectId,
      queryVec.embedding,
      kind,
      effectiveLimit,
      signature,
    );
  }

  private vectorMetadata(embedded: EmbeddedVector): KnowledgeVectorMetadata {
    return {
      model: embedded.profile.model,
      dim: embedded.profile.dim,
      url: embedded.profile.url,
      signature: makeEmbedderSignature(embedded.profile),
      embeddedAt: Date.now(),
    };
  }
}
