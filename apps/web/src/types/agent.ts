export type AgentStatus = "draft" | "active" | "merged" | "abandoned";

export interface AgentFull {
  id: number;
  projectId: number;
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
  createdAt: string;
  dispatchedAt: string | null;
  updatedAt: string;
  mergedAt: string | null;
  mergedCommit: string | null;
  abandonedReason: string | null;
  deletedAt: string | null;
}

export interface AgentSummary {
  slug: string;
  status: AgentStatus;
  branch: string;
  worktree: string;
  reservedPaths: string[];
  createdAt: string;
  dispatchedAt: string | null;
  updatedAt: string;
  mergedAt: string | null;
  mergedCommit: string | null;
  abandonedReason: string | null;
}
