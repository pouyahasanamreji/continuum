// Synchronous because better-sqlite3 is synchronous.
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Knowledge } from '../../domain/knowledge';

export interface KnowledgeCreatePayload {
  agentId: number;
  slug: string;
  content: string;
  now: number;
}

export interface KnowledgeUpdatePatch {
  agentId?: number;
  content?: string;
  updatedAt: number;
}

export type KnowledgeCreateResult =
  | { ok: true; knowledge: Knowledge }
  | { ok: false; reason: 'slug_conflict' };

export interface KnowledgeFilterOptions {
  agentId?: number | null;
  slug?: string | null;
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
  abstract findAll(projectId: number): Knowledge[];
  abstract findManyWithPagination(
    projectId: number,
    options: KnowledgeFindManyOptions,
  ): Knowledge[];
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
    query: string,
    limit: number,
  ): Knowledge[];
}
