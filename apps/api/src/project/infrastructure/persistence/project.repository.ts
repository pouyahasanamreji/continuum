// Synchronous repository (better-sqlite3 is sync) — diverges from
// boilerplate's Promise-returning ports.
import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
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
  abstract findIdByPath(path: string): number | null;
  abstract findById(id: number): Project | null;
  abstract findByPath(path: string): Project | null;
  abstract findAll(): Project[];
  abstract findManyWithPagination(options: IPaginationOptions): Project[];

  abstract create(payload: ProjectCreatePayload): ProjectCreateResult;
  abstract update(id: number, payload: DeepPartial<Project>): Project;
  abstract hardRemove(id: number): { cascadedAgents: number };
}
