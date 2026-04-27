export type AgentStatus = 'draft' | 'active' | 'merged' | 'abandoned';

export class Agent {
  projectPath!: string;
  slug!: string;
  status!: AgentStatus;
  branch!: string;
  worktree!: string;
  reservedPaths!: string[];
  request!: string;
  plan!: string;
  implPrompt!: string;
  coordinationBrief!: string;
  postMergeNotes!: string;
  createdAt!: number;
  dispatchedAt!: number | null;
  updatedAt!: number;
  mergedAt!: number | null;
  mergedCommit!: string | null;
  abandonedReason!: string | null;
}
