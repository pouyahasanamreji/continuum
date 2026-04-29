export interface KnowledgeFull {
  id: number;
  projectId: number;
  agentId: number;
  slug: string;
  content: string;
  kind: "fundamental" | "situational";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
