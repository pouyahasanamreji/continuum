import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUpdateError } from '../common/errors/service-errors';
import { getKnowledgeDto } from './dto/get-knowledge.dto';
import type { GetKnowledgeDto } from './dto/get-knowledge.dto';
import { applyKnowledgeDiffDto } from './dto/apply-knowledge-diff.dto';
import type { ApplyKnowledgeDiffDto } from './dto/apply-knowledge-diff.dto';

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
      if (args.section) {
        const section = this.knowledge.getSection(args.project, args.section);
        if (section === null) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Section "${args.section}" not found.`,
              },
            ],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: section }] };
      }
      const all = this.knowledge.getAll(args.project);
      if (!all) {
        return {
          content: [
            { type: 'text' as const, text: 'Knowledge document is empty.' },
          ],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: all.content }] };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'knowledge_update',
    description:
      'Apply a unified-diff (git-format) to the project knowledge.md. Diff MUST include `--- a/knowledge.md` and `+++ b/knowledge.md` headers. Hunks must match current content with zero fuzz — get-edit-diff loop on mismatch.',
    parameters: applyKnowledgeDiffDto,
  })
  knowledgeUpdate(args: ApplyKnowledgeDiffDto) {
    try {
      const result = this.knowledge.applyDiff(args.project, args.diff);
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
