// Synchronous repository (better-sqlite3 is sync) — diverges from
// boilerplate's Promise-returning ports.
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Agent } from '../../domain/agent';
import { AgentSummary } from '../../domain/agent-summary';
import { AgentStatusEnum } from '../../../agent-statuses/agent-statuses.enum';

export interface AgentCreatePayload {
  slug: string;
  branch: string;
  worktree: string;
  reservedPaths: string[];
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
  now: number;
}

export interface AgentUpdatePatch {
  status?: AgentStatusEnum;
  dispatchedAt?: number;
  mergedAt?: number;
  mergedCommit?: string;
  abandonedReason?: string;
  reservedPaths?: string[];
  postMergeNotes?: string;
  plan?: string;
  implPrompt?: string;
  coordinationBrief?: string;
  updatedAt: number;
}

export interface AgentListOptions {
  status?: AgentStatusEnum;
}

export interface AgentFindManyOptions extends IPaginationOptions {
  status?: AgentStatusEnum;
}

export type AgentCreateResult =
  | { ok: true; agent: Agent }
  | { ok: false; reason: 'slug_conflict' };

export abstract class AgentRepository {
  abstract findAll(
    projectId: number,
    options?: AgentListOptions,
  ): AgentSummary[];
  abstract findManyWithPagination(
    projectId: number,
    options: AgentFindManyOptions,
  ): AgentSummary[];
  abstract findById(id: number): Agent | null;
  abstract findByProjectIdAndSlug(
    projectId: number,
    slug: string,
  ): Agent | null;
  abstract create(
    projectId: number,
    payload: AgentCreatePayload,
  ): AgentCreateResult;
  abstract update(id: number, patch: AgentUpdatePatch): void;
}
