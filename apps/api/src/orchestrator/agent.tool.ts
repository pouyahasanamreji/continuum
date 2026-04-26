import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { AgentService } from './agent.service';

const slugSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

@Injectable()
export class AgentTool {
  constructor(private readonly agents: AgentService) {}

  @Tool({
    name: 'registry_list',
    description:
      'List all agents with status, branch, worktree, reservedPaths.',
    parameters: z.object({}),
  })
  registryList() {
    const all = this.agents.list();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(all, null, 2) }],
    };
  }

  @Tool({
    name: 'agent_get',
    description: 'Get full record for an agent by slug.',
    parameters: z.object({ slug: z.string() }),
  })
  agentGet(args: { slug: string }) {
    const found = this.agents.get(args.slug);
    if (!found) {
      return {
        content: [
          { type: 'text' as const, text: `Agent "${args.slug}" not found.` },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(found, null, 2) },
      ],
    };
  }

  @Tool({
    name: 'agent_create',
    description: 'Create a new agent in draft state. Returns full record.',
    parameters: z.object({
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
    slug: string;
    branch: string;
    worktree: string;
    reservedPaths: string[];
    request: string;
    plan: string;
    implPrompt: string;
    coordinationBrief: string;
  }) {
    const created = this.agents.create(args);
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(created, null, 2) },
      ],
    };
  }

  @Tool({
    name: 'agent_update',
    description:
      'Update agent. Allowed transitions: draft→active, active→merged|abandoned. merged requires mergedCommit (len≥7). abandoned requires abandonedReason.',
    parameters: z.object({
      slug: z.string(),
      status: z.enum(['active', 'merged', 'abandoned']).optional(),
      reservedPaths: z.array(z.string()).optional(),
      postMergeNotes: z.string().optional(),
      mergedCommit: z.string().optional(),
      abandonedReason: z.string().optional(),
    }),
  })
  agentUpdate(args: {
    slug: string;
    status?: 'active' | 'merged' | 'abandoned';
    reservedPaths?: string[];
    postMergeNotes?: string;
    mergedCommit?: string;
    abandonedReason?: string;
  }) {
    const { slug, ...patch } = args;
    const updated = this.agents.update(slug, patch);
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(updated, null, 2) },
      ],
    };
  }
}
