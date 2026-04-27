import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { Project } from './domain/project';
import { ProjectServiceError } from '../common/errors/service-errors';
import {
  ProjectRepository,
  ProjectUpdatePatch,
} from './infrastructure/persistence/project.repository';
import { PlotService } from '../plot/plot.service';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly repo: ProjectRepository,
    private readonly plot: PlotService,
  ) {}

  canonicalize(input: string): string {
    if (typeof input !== 'string' || input.length === 0) {
      throw new ProjectServiceError('invalid_path', 'empty');
    }
    if (input.startsWith('~')) {
      throw new ProjectServiceError(
        'invalid_path',
        'tilde-expansion not supported',
      );
    }
    if (!input.startsWith('/')) {
      throw new ProjectServiceError(
        'invalid_path',
        'must be absolute (start with /)',
      );
    }
    if (input.includes('\\')) {
      throw new ProjectServiceError('invalid_path', 'backslash not allowed');
    }
    let p = input.normalize('NFC').replace(/\/+/g, '/');
    if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
    if (p === '/') {
      throw new ProjectServiceError('invalid_path', 'root not allowed');
    }
    if (/(^|\/)\.{1,2}(\/|$)/.test(p)) {
      throw new ProjectServiceError(
        'invalid_path',
        'relative segments not allowed',
      );
    }
    if (p.length > 1024) {
      throw new ProjectServiceError(
        'invalid_path',
        'path too long (>1024 chars)',
      );
    }
    return p;
  }

  list(): Project[] {
    return this.repo.findAll();
  }

  findManyWithPagination(queryProjectDto: QueryProjectDto): Project[] {
    const {
      page = 1,
      limit = 10,
      filters = null,
      sort = null,
    } = queryProjectDto;
    return this.repo.findManyWithPagination({
      filterOptions: filters,
      sortOptions: sort,
      paginationOptions: { page, limit },
    });
  }

  get(path: string): Project | null {
    return this.repo.findByPath(path);
  }

  findIdByPathOrThrow(path: string): number {
    const id = this.repo.findIdByPath(path);
    if (id === null) {
      throw new ProjectServiceError('project_not_found', path);
    }
    return id;
  }

  assertExists(path: string): void {
    if (this.repo.findIdByPath(path) === null) {
      throw new ProjectServiceError('project_not_found', path);
    }
  }

  create(input: { path: string; name?: string }): Project {
    const path = this.canonicalize(input.path);
    const name = (input.name ?? basename(path)).trim();
    if (!name) {
      throw new ProjectServiceError('invalid_name', 'empty after trim');
    }
    if (/[\r\n]/.test(name)) {
      throw new ProjectServiceError('invalid_name', 'newlines not allowed');
    }
    const result = this.repo.create({
      path,
      name,
      plotContent: this.plot.defaultTemplate(),
      knowledgeContent: '',
      now: Date.now(),
    });
    if (!result.ok) {
      throw new ProjectServiceError('project_exists', path);
    }
    return result.project;
  }

  update(path: string, patch: { name?: string }): Project {
    const canonical = this.canonicalize(path);
    const id = this.findIdByPathOrThrow(canonical);
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed || /[\r\n]/.test(trimmed)) {
        throw new ProjectServiceError('invalid_name');
      }
      const repoPatch: ProjectUpdatePatch = {
        name: trimmed,
        updatedAt: Date.now(),
      };
      return this.repo.update(id, repoPatch);
    }
    const existing = this.repo.findById(id);
    if (!existing) throw new ProjectServiceError('project_not_found', path);
    return existing;
  }

  remove(path: string): { deleted: true; cascadedAgents: number } {
    const canonical = this.canonicalize(path);
    const id = this.findIdByPathOrThrow(canonical);
    const { cascadedAgents } = this.repo.remove(id);
    return { deleted: true, cascadedAgents };
  }
}
