// Synchronous repository (better-sqlite3 is sync). Lookup is by project_id
// (1:1 with project), no findById. applyDiff race window: service-side read,
// adapter-side write. Single-writer assumption.
import { Knowledge } from '../../domain/knowledge';

export interface KnowledgeApplyDiffPayload {
  unifiedDiff: string;
  newContent: string;
  now: number;
}

export abstract class KnowledgeRepository {
  abstract findByProjectId(projectId: number): Knowledge | null;
  abstract upsert(projectId: number, content: string, now: number): void;
  abstract applyDiff(
    projectId: number,
    payload: KnowledgeApplyDiffPayload,
  ): void;
}
