import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { Project } from './domain/project';
import { ProjectServiceError } from '../common/errors/service-errors';
import {
  ProjectRepository,
  ProjectUpdatePatch,
} from './infrastructure/persistence/project.repository';
import { PlotService } from '../plot/plot.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
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

  findAll(): Project[] {
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

  findOne(path: string): Project | null {
    const canonical = this.canonicalize(path);
    return this.repo.findByPath(canonical);
  }

  private findIdByPathOrThrow(path: string): number {
    const id = this.repo.findIdByPath(path);
    if (id === null) {
      throw new ProjectServiceError('project_not_found', path);
    }
    return id;
  }

  create(createProjectDto: CreateProjectDto): Project {
    const path = this.canonicalize(createProjectDto.path);
    const name = (createProjectDto.name ?? basename(path)).trim();
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
      now: Date.now(),
    });
    if (!result.ok) {
      throw new ProjectServiceError('project_exists', path);
    }
    return result.project;
  }

  update(path: string, updateProjectDto: UpdateProjectDto): Project {
    const canonical = this.canonicalize(path);
    const id = this.findIdByPathOrThrow(canonical);
    if (updateProjectDto.name === undefined) {
      throw new ProjectServiceError('no_change', canonical);
    }
    const trimmed = updateProjectDto.name.trim();
    if (!trimmed || /[\r\n]/.test(trimmed)) {
      throw new ProjectServiceError('invalid_name');
    }
    const repoPatch: ProjectUpdatePatch = {
      name: trimmed,
      updatedAt: Date.now(),
    };
    return this.repo.update(id, repoPatch);
  }

  remove(path: string): { deleted: true; cascadedAgents: number } {
    const canonical = this.canonicalize(path);
    const id = this.findIdByPathOrThrow(canonical);
    const { cascadedAgents } = this.repo.remove(id);
    return { deleted: true, cascadedAgents };
  }
}
