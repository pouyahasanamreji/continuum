import type { AgentStatus } from '../../../../domain/agent';

export interface AgentEntity {
  id: number;
  project_id: number;
  slug: string;
  status: AgentStatus;
  branch: string;
  worktree: string;
  reserved_paths_json: string;
  request: string;
  plan: string;
  impl_prompt: string;
  coordination_brief: string;
  post_merge_notes: string;
  created_at: number;
  dispatched_at: number | null;
  updated_at: number;
  merged_at: number | null;
  merged_commit: string | null;
  abandoned_reason: string | null;
  deleted_at: number | null;
}
