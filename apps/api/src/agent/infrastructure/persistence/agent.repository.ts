// Synchronous repository (better-sqlite3 is sync) — diverges from
// boilerplate's Promise-returning ports.
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Agent, AgentStatus } from '../../domain/agent';

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
  status?: AgentStatus;
  dispatchedAt?: number;
  mergedAt?: number;
  mergedCommit?: string;
  abandonedReason?: string;
  reservedPaths?: string[];
  postMergeNotes?: string;
  updatedAt: number;
}

export interface AgentMigrationPayload {
  branch: string;
  worktree: string;
  reservedPaths: string[];
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
  postMergeNotes: string;
  status: AgentStatus;
  dispatchedAt: number | null;
  mergedAt: number | null;
  mergedCommit: string | null;
  now: number;
}

export type AgentCreateResult =
  | { ok: true; agent: Agent }
  | { ok: false; reason: 'slug_conflict' };

export abstract class AgentRepository {
  abstract findAll(projectId: number): Agent[];
  abstract findManyWithPagination(
    projectId: number,
    options: IPaginationOptions,
  ): Agent[];
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
  abstract upsertFromMigration(
    projectId: number,
    slug: string,
    payload: AgentMigrationPayload,
  ): void;
}
