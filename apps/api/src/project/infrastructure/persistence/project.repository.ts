// Synchronous repository (better-sqlite3 is sync) — diverges from
// boilerplate's Promise-returning ports.
import { Project } from '../../domain/project';

export interface ProjectCreatePayload {
  path: string;
  name: string;
  plotContent: string;
  knowledgeContent: string;
  now: number;
}

export type ProjectCreateResult =
  | { ok: true; project: Project }
  | { ok: false; reason: 'project_exists' };

export abstract class ProjectRepository {
  abstract list(): Project[];
  abstract findByPath(path: string): Project | null;
  abstract exists(path: string): boolean;
  abstract create(payload: ProjectCreatePayload): ProjectCreateResult;
  abstract rename(path: string, name: string, now: number): Project;
  abstract delete(path: string): { cascadedAgents: number };
}
