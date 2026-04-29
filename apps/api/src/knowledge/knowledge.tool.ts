import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeServiceError } from '../common/errors/service-errors';
import { getKnowledgeDto } from './dto/knowledge.dto';
import type { GetKnowledgeDto } from './dto/knowledge.dto';
import {
  listKnowledgeDto,
  searchKnowledgeDto,
} from './dto/query-knowledge.dto';
import type {
  ListKnowledgeDto,
  SearchKnowledgeDto,
} from './dto/query-knowledge.dto';
import { createKnowledgeDto } from './dto/create-knowledge.dto';
import type { CreateKnowledgeInput } from './dto/create-knowledge.dto';
import { updateKnowledgeDto } from './dto/update-knowledge.dto';
import type { UpdateKnowledgeInput } from './dto/update-knowledge.dto';
import { z } from 'zod';

const deleteKnowledgeDto = z.object({
  project: z.string(),
  slug: z.string(),
});
type DeleteKnowledgeDto = z.infer<typeof deleteKnowledgeDto>;

function toolError(err: unknown) {
  const msg =
    err instanceof KnowledgeServiceError
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
export class KnowledgeTool {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Tool({
    name: 'knowledge_list',
    description:
      'List all knowledge lessons for `project` (newest first). Each row carries `slug`, `agentId`, `content`, timestamps. `project` is the canonical absolute path (your `pwd`). Use this tool when you want a full inventory; use `knowledge_search` when scanning for relevance.',
    parameters: listKnowledgeDto,
  })
  knowledgeList(args: ListKnowledgeDto) {
    try {
      return toolSuccess(this.knowledge.list(args.project));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_get',
    description:
      'Get one knowledge lesson by `project` + `slug`. Returns the full row including `content`. Use this tool when you already know which lesson to read.',
    parameters: getKnowledgeDto,
  })
  knowledgeGet(args: GetKnowledgeDto) {
    try {
      const found = this.knowledge.get(args.project, args.slug);
      if (!found) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Knowledge "${args.slug}" not found in project "${args.project}".`,
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
    name: 'knowledge_create',
    description:
      'Create a new knowledge lesson under `project` attributed to `agentSlug`. `slug` matches /^[a-z][a-z0-9-]*$/ and is unique within the project. `content` is the full lesson body (markdown OK). Use this tool when recording a reusable lesson at post-merge file-back. Optional `kind` is `"fundamental"` (binding rule applied to every dispatch) or `"situational"` (context-specific). Defaults to `"situational"`.',
    parameters: createKnowledgeDto,
  })
  async knowledgeCreate(args: CreateKnowledgeInput) {
    try {
      return toolSuccess(await this.knowledge.create(args));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_update',
    description:
      'Whole-content replace of a knowledge lesson by `project` + `slug`. Pass new `content` (full body) and/or new `agentSlug`. Slug rename is not supported — delete+create instead. Empty patch throws `no_change`. Optional `kind` patches the lesson kind ("fundamental" or "situational").',
    parameters: updateKnowledgeDto,
  })
  async knowledgeUpdate(args: UpdateKnowledgeInput) {
    try {
      return toolSuccess(await this.knowledge.update(args.slug, args));
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_delete',
    description:
      'Hard-delete a knowledge lesson by `project` + `slug`. Returns `{deleted: true}` on success. Use this tool to retire a lesson that no longer applies.',
    parameters: deleteKnowledgeDto,
  })
  knowledgeDelete(args: DeleteKnowledgeDto) {
    try {
      this.knowledge.remove(args.project, args.slug);
      return toolSuccess({ deleted: true });
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_search',
    description:
      'Substring search across knowledge lessons in `project`. At least one of `q` or `kind` is required. `q` matches `content` OR `slug` (case-insensitive ASCII). `kind: "fundamental"` filters to binding lessons that must be followed on every dispatch; `kind: "situational"` filters to context-specific lessons. Optional `limit` (default 10, max 50). Use this tool at Phase-1 Intake — first with `kind: "fundamental"` to load every binding rule, then with `q` for topical relevance.',
    parameters: searchKnowledgeDto,
  })
  knowledgeSearch(args: SearchKnowledgeDto) {
    try {
      return toolSuccess(
        this.knowledge.search(args.project, args.q, args.kind, args.limit),
      );
    } catch (e) {
      return toolError(e);
    }
  }
}
