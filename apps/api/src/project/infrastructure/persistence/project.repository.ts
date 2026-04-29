// Synchronous repository (better-sqlite3 is sync) — diverges from
// boilerplate's Promise-returning ports.
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Project } from '../../domain/project';
import { FilterProjectDto, SortProjectDto } from '../../dto/query-project.dto';

export interface ProjectCreatePayload {
  path: string;
  name: string;
  plotContent: string;
  now: number;
}

export type ProjectCreateResult =
  | { ok: true; project: Project }
  | { ok: false; reason: 'project_exists' };

export interface ProjectUpdatePatch {
  name?: string;
  updatedAt: number;
}

export abstract class ProjectRepository {
  abstract findIdByPath(path: string): number | null;
  abstract findById(id: number): Project | null;
  abstract findByPath(path: string): Project | null;
  abstract findAll(): Project[];
  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProjectDto | null;
    sortOptions?: SortProjectDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Project[];

  abstract create(payload: ProjectCreatePayload): ProjectCreateResult;
  abstract update(id: number, patch: ProjectUpdatePatch): Project;
  abstract remove(id: number): { cascadedAgents: number };
}
