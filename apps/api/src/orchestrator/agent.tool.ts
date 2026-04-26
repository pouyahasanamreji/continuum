import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { AgentService, AgentServiceError } from './agent.service';

const slugSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

function toolError(err: unknown) {
  const msg =
    err instanceof AgentServiceError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    content: [{ type: 'text' as const, text: msg }],
    isError: true,
  };
}

@Injectable()
export class AgentTool {
  constructor(private readonly agents: AgentService) {}

  @Tool({
    name: 'registry_list',
    description:
      'List all agents in `project` with status, branch, worktree, reservedPaths. `project` is the canonical absolute path of the working tree (your `pwd`).',
    parameters: z.object({ project: z.string() }),
  })
  registryList(args: { project: string }) {
    try {
      const all = this.agents.list(args.project);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(all, null, 2) },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'agent_get',
    description: 'Get full record for an agent by `project` + `slug`.',
    parameters: z.object({
      project: z.string(),
      slug: z.string(),
    }),
  })
  agentGet(args: { project: string; slug: string }) {
    try {
      const found = this.agents.get(args.project, args.slug);
      if (!found) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Agent "${args.slug}" not found in project "${args.project}".`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(found, null, 2) },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'agent_create',
    description:
      'Create a new agent in draft state under `project`. Returns full record.',
    parameters: z.object({
      project: z.string(),
      slug: slugSchema,
      branch: z.string(),
      worktree: z.string(),
      reservedPaths: z.array(z.string()).default([]),
      request: z.string(),
      plan: z.string(),
      implPrompt: z.string(),
      coordinationBrief: z.string(),
    }),
  })
  agentCreate(args: {
    project: string;
    slug: string;
    branch: string;
    worktree: string;
    reservedPaths: string[];
    request: string;
    plan: string;
    implPrompt: string;
    coordinationBrief: string;
  }) {
    try {
      const { project, ...rest } = args;
      const created = this.agents.create(project, rest);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(created, null, 2) },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'agent_update',
    description:
      'Update an agent in `project`. Allowed transitions: draft→active, active→merged|abandoned. merged requires mergedCommit (len≥7). abandoned requires abandonedReason.',
    parameters: z.object({
      project: z.string(),
      slug: z.string(),
      status: z.enum(['active', 'merged', 'abandoned']).optional(),
      reservedPaths: z.array(z.string()).optional(),
      postMergeNotes: z.string().optional(),
      mergedCommit: z.string().optional(),
      abandonedReason: z.string().optional(),
    }),
  })
  agentUpdate(args: {
    project: string;
    slug: string;
    status?: 'active' | 'merged' | 'abandoned';
    reservedPaths?: string[];
    postMergeNotes?: string;
    mergedCommit?: string;
    abandonedReason?: string;
  }) {
    try {
      const { project, slug, ...patch } = args;
      const updated = this.agents.update(project, slug, patch);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(updated, null, 2) },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }
}
