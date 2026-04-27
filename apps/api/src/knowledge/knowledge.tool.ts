import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUpdateError } from '../common/errors/service-errors';
import { getKnowledgeDto } from './dto/query-knowledge.dto';
import type { GetKnowledgeDto } from './dto/query-knowledge.dto';
import { updateKnowledgeDto } from './dto/update-knowledge.dto';
import type { UpdateKnowledgeInput } from './dto/update-knowledge.dto';

function toolError(err: unknown) {
  const msg =
    err instanceof KnowledgeUpdateError
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
export class KnowledgeTool {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Tool({
    name: 'knowledge_get',
    description:
      'Read the orchestrator knowledge document for `project`. Optional `section` arg returns only that ## section. `project` is the canonical absolute path of the working tree (your `pwd`).',
    parameters: getKnowledgeDto,
  })
  knowledgeGet(args: GetKnowledgeDto) {
    try {
      const found = args.section
        ? this.knowledge.findBySection(args.project, args.section)
        : this.knowledge.findOne(args.project);
      if (!found) {
        return {
          content: [
            {
              type: 'text' as const,
              text: args.section
                ? `Section "${args.section}" not found.`
                : 'Knowledge document is empty.',
            },
          ],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: found.content }] };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_update',
    description:
      'Apply a unified-diff (git-format) to the project knowledge.md. Diff MUST include `--- a/knowledge.md` and `+++ b/knowledge.md` headers. Hunks must match current content with zero fuzz — get-edit-diff loop on mismatch.',
    parameters: updateKnowledgeDto,
  })
  knowledgeUpdate(args: UpdateKnowledgeInput) {
    try {
      const result = this.knowledge.update({
        project: args.project,
        diff: args.diff,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `knowledge.md updated at ${result.updatedAt.toISOString()}`,
          },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }
}
