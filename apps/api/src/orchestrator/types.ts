export type AgentStatus = 'draft' | 'active' | 'merged' | 'abandoned';

export interface AgentRow {
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
}

export interface AgentFull {
  slug: string;
  status: AgentStatus;
  branch: string;
  worktree: string;
  reservedPaths: string[];
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
  postMergeNotes: string;
  createdAt: number;
  dispatchedAt: number | null;
  updatedAt: number;
  mergedAt: number | null;
  mergedCommit: string | null;
  abandonedReason: string | null;
}

export interface AgentCreateInput {
  slug: string;
  branch: string;
  worktree: string;
  reservedPaths?: string[];
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
}

export interface AgentUpdateInput {
  slug: string;
  status?: 'active' | 'merged' | 'abandoned';
  reservedPaths?: string[];
  postMergeNotes?: string;
  mergedCommit?: string;
  abandonedReason?: string;
}

export interface KnowledgeUpdateResult {
  updatedAt: number;
}

export interface KnowledgeReadResult {
  content: string;
  updatedAt: number;
}
