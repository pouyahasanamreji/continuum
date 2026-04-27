export const AgentStatusEnum = {
  draft: 'draft',
  active: 'active',
  merged: 'merged',
  abandoned: 'abandoned',
} as const;
export type AgentStatusEnum =
  (typeof AgentStatusEnum)[keyof typeof AgentStatusEnum];
