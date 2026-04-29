export interface KnowledgeEntity {
  id: number;
  project_id: number;
  agent_id: number;
  slug: string;
  content: string;
  kind: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
