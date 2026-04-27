// Synchronous repository (better-sqlite3 is sync). Lookup is by project_id
// (1:1 with project), no findById. applyDiff race window: service-side read,
// adapter-side write. Single-writer assumption.
import { Plot } from '../../domain/plot';

export interface PlotApplyDiffPayload {
  unifiedDiff: string;
  newContent: string;
  now: number;
}

export abstract class PlotRepository {
  abstract findByProjectId(projectId: number): Plot | null;
  abstract upsert(projectId: number, content: string, now: number): void;
  abstract applyDiff(projectId: number, payload: PlotApplyDiffPayload): void;
}
