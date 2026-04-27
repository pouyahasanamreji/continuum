import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ProjectService } from './project.service';
import { ProjectServiceError } from '../common/errors/service-errors';
import { createProjectDto } from './dto/create-project.dto';
import type { CreateProjectDto } from './dto/create-project.dto';
import { renameProjectDto } from './dto/update-project.dto';
import type { RenameProjectInput } from './dto/update-project.dto';
import { pathOnlyDto } from './dto/project.dto';
import type { PathOnlyDto } from './dto/project.dto';

function toolError(err: unknown) {
  const msg =
    err instanceof ProjectServiceError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    content: [{ type: 'text' as const, text: msg }],
    isError: true,
  };
}

function toolSuccess(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

@Injectable()
export class ProjectTool {
  constructor(private readonly projects: ProjectService) {}

  @Tool({
    name: 'project_list',
    description:
      'List all projects (orchestrator project records). Returns array of {id, path, name, createdAt, updatedAt, deletedAt}.',
    parameters: z.object({}),
  })
  projectList() {
    try {
      return toolSuccess(this.projects.findAll());
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_get',
    description:
      'Get a project by canonical absolute path. Use your `pwd` as `path`. Returns null if not found (no error).',
    parameters: pathOnlyDto,
  })
  projectGet(args: PathOnlyDto) {
    try {
      const found = this.projects.findOne(args.path);
      return toolSuccess(found);
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_create',
    description:
      'Create a new project keyed by canonical absolute path. `name` defaults to the basename of `path`. Initialises empty knowledge + default PLOT.',
    parameters: createProjectDto,
  })
  projectCreate(args: CreateProjectDto) {
    try {
      return toolSuccess(this.projects.create(args));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_rename',
    description:
      'Rename an existing project. `path` identifies the project; `name` is the new display name.',
    parameters: renameProjectDto,
  })
  projectRename(args: RenameProjectInput) {
    try {
      return toolSuccess(this.projects.update(args.path, args));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_delete',
    description:
      'Delete a project and CASCADE all of its plot/knowledge/agents. Returns {deleted: true, cascadedAgents: N}.',
    parameters: pathOnlyDto,
  })
  projectDelete(args: PathOnlyDto) {
    try {
      return toolSuccess(this.projects.remove(args.path));
    } catch (e) {
      return toolError(e);
    }
  }
}
