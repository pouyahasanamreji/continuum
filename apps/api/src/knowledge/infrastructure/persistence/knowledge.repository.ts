// Synchronous because better-sqlite3 is synchronous.
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { KnowledgeKindEnum } from '../../../knowledge-kinds/knowledge-kinds.enum';
import { Knowledge } from '../../domain/knowledge';
import { KnowledgeSummary } from '../../domain/knowledge-summary';

export interface KnowledgeCreatePayload {
  agentId: number;
  slug: string;
  content: string;
  kind: KnowledgeKindEnum;
  now: number;
}

export interface KnowledgeUpdatePatch {
  agentId?: number;
  content?: string;
  kind?: KnowledgeKindEnum;
  updatedAt: number;
}

export type KnowledgeCreateResult =
  | { ok: true; knowledge: Knowledge }
  | { ok: false; reason: 'slug_conflict' };

export interface KnowledgeFilterOptions {
  agentId?: number | null;
  slug?: string | null;
  kind?: KnowledgeKindEnum | null;
  q?: string | null;
}

export interface KnowledgeSortOption {
  orderBy: keyof Knowledge;
  order: string;
}

export interface KnowledgeFindManyOptions {
  filterOptions?: KnowledgeFilterOptions | null;
  sortOptions?: KnowledgeSortOption[] | null;
  paginationOptions: IPaginationOptions;
}

export abstract class KnowledgeRepository {
  abstract findAll(
    projectId: number,
    opts?: { kind?: KnowledgeKindEnum },
  ): KnowledgeSummary[];
  abstract findManyWithPagination(
    projectId: number,
    options: KnowledgeFindManyOptions,
  ): KnowledgeSummary[];
  abstract findById(id: number): Knowledge | null;
  abstract findByProjectIdAndSlug(
    projectId: number,
    slug: string,
  ): Knowledge | null;
  abstract create(
    projectId: number,
    payload: KnowledgeCreatePayload,
  ): KnowledgeCreateResult;
  abstract update(id: number, patch: KnowledgeUpdatePatch): void;
  abstract remove(id: number): void;
  abstract searchByContent(
    projectId: number,
    query: string | undefined,
    kind: KnowledgeKindEnum | undefined,
    limit: number,
  ): KnowledgeSummary[];
  abstract searchByVector(
    projectId: number,
    queryEmbedding: number[],
    kind: KnowledgeKindEnum | undefined,
    limit: number,
    signature: string,
  ): KnowledgeSummary[];
  abstract findAllForVectorize(
    mode: 'missing' | 'all',
    signature?: string,
  ): Array<{ id: number; content: string }>;
  abstract countFreshForSearch(
    projectId: number,
    kind: KnowledgeKindEnum | undefined,
    signature: string,
  ): number;
}
