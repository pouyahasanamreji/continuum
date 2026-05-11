export interface KnowledgeFull {
  id: number;
  projectId: number;
  agentId: number;
  agentSlug: string;
  slug: string;
  content: string;
  kind: "fundamental" | "situational";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface KnowledgeSummary {
  slug: string;
  kind: "fundamental" | "situational";
  agentSlug: string;
  createdAt: string;
  updatedAt: string;
}
