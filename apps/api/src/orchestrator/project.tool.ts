import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ProjectService, ProjectServiceError } from './project.service';

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
      'List all projects (orchestrator project records). Returns array of {path, name, createdAt, updatedAt}.',
    parameters: z.object({}),
  })
  projectList() {
    try {
      return toolSuccess(this.projects.list());
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_get',
    description:
      'Get a project by canonical absolute path. Use your `pwd` as `path`. Returns null if not found (no error).',
    parameters: z.object({ path: z.string() }),
  })
  projectGet(args: { path: string }) {
    try {
      const canonical = this.projects.canonicalize(args.path);
      const found = this.projects.get(canonical);
      return toolSuccess(found);
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_create',
    description:
      'Create a new project keyed by canonical absolute path. `name` defaults to the basename of `path`. Initialises empty knowledge + default PLOT.',
    parameters: z.object({
      path: z.string(),
      name: z.string().optional(),
    }),
  })
  projectCreate(args: { path: string; name?: string }) {
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
    parameters: z.object({
      path: z.string(),
      name: z.string(),
    }),
  })
  projectRename(args: { path: string; name: string }) {
    try {
      return toolSuccess(this.projects.rename(args.path, args.name));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'project_delete',
    description:
      'Delete a project and CASCADE all of its plot/knowledge/agents. Returns {deleted: true, cascadedAgents: N}.',
    parameters: z.object({ path: z.string() }),
  })
  projectDelete(args: { path: string }) {
    try {
      return toolSuccess(this.projects.delete(args.path));
    } catch (e) {
      return toolError(e);
    }
  }
}
