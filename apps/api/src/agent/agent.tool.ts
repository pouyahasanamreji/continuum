import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { AgentService } from './agent.service';
import { AgentServiceError } from '../common/errors/service-errors';
import { listAgentDto } from './dto/list-agent.dto';
import type { ListAgentDto } from './dto/list-agent.dto';
import { getAgentDto } from './dto/get-agent.dto';
import type { GetAgentDto } from './dto/get-agent.dto';
import { createAgentDto } from './dto/create-agent.dto';
import type { CreateAgentInput } from './dto/create-agent.dto';
import { updateAgentDto } from './dto/update-agent.dto';
import type { UpdateAgentInput } from './dto/update-agent.dto';

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
    parameters: listAgentDto,
  })
  registryList(args: ListAgentDto) {
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
    parameters: getAgentDto,
  })
  agentGet(args: GetAgentDto) {
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
    parameters: createAgentDto,
  })
  agentCreate(args: CreateAgentInput) {
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
    parameters: updateAgentDto,
  })
  agentUpdate(args: UpdateAgentInput) {
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
