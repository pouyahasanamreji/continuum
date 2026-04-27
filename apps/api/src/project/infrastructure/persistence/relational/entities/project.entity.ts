export interface ProjectEntity {
  id: number;
  path: string;
  name: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
