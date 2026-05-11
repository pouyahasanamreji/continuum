import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { AgentService } from './agent.service';
import { AgentServiceError } from '../common/errors/service-errors';
import { listAgentDto } from './dto/query-agent.dto';
import type { ListAgentDto } from './dto/query-agent.dto';
import { getAgentDto } from './dto/agent.dto';
import type { GetAgentDto } from './dto/agent.dto';
import { createAgentDto } from './dto/create-agent.dto';
import type { CreateAgentInput } from './dto/create-agent.dto';
import { updateAgentDto } from './dto/update-agent.dto';
import type { UpdateAgentInput } from './dto/update-agent.dto';

const LIST_DEFAULT_LIMIT = 10;
const LIST_MAX_LIMIT = 50;

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

function toolSuccess(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

@Injectable()
export class AgentTool {
  constructor(private readonly agents: AgentService) {}

  @Tool({
    name: 'registry_list',
    description:
      'List agent dispatch metadata for `project` (newest first), paginated. Returns `{data, page, limit, hasNextPage}` where each `data` entry carries `slug, status, branch, worktree, reservedPaths, createdAt, dispatchedAt, updatedAt, mergedAt, mergedCommit, abandonedReason` — no `request`, `plan`, `implPrompt`, `coordinationBrief`, `postMergeNotes`. Call `agent_get({project, slug})` for the full record (artifacts + notes). Optional `status` filters to `draft|active|merged|abandoned` (use `status: "active"` for the collision matrix). Optional `page` (default 1) and `limit` (default 10, max 50). When `hasNextPage` is true, increment `page` and call again.',
    parameters: listAgentDto,
  })
  registryList(args: ListAgentDto) {
    try {
      const page = args.page ?? 1;
      const limit = Math.min(args.limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
      const data = this.agents.findManyWithPagination({
        project: args.project,
        page,
        limit,
        filters: args.status ? { status: args.status } : null,
      });
      const hasNextPage = data.length === limit;
      return toolSuccess({ data, page, limit, hasNextPage });
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'agent_get',
    description:
      'Get full record for an agent by `project` + `slug`. Returns every field including `request`, `plan`, `implPrompt`, `coordinationBrief`, `postMergeNotes`. Use this after `registry_list` to drill into any agent whose body you need.',
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
      return toolSuccess(found);
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
      return toolSuccess(this.agents.create(args));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'agent_update',
    description:
      'Update an agent in `project`. Allowed transitions: draft→active, active→merged|abandoned. merged requires mergedCommit (len≥7). abandoned requires abandonedReason. plan/implPrompt/coordinationBrief patchable while status ∈ {draft, active}; frozen on merged/abandoned.',
    parameters: updateAgentDto,
  })
  agentUpdate(args: UpdateAgentInput) {
    try {
      return toolSuccess(this.agents.update(args.slug, args));
    } catch (e) {
      return toolError(e);
    }
  }
}
