import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { KnowledgeService, KnowledgeUpdateError } from './knowledge.service';

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
    parameters: z.object({
      project: z.string(),
      section: z.string().optional(),
    }),
  })
  knowledgeGet(args: { project: string; section?: string }) {
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
    parameters: z.object({
      project: z.string(),
      diff: z.string().min(1),
    }),
  })
  knowledgeUpdate(args: { project: string; diff: string }) {
    try {
      const result = this.knowledge.applyDiff(args.project, args.diff);
      return {
        content: [
          {
            type: 'text' as const,
            text: `knowledge.md updated at ${new Date(result.updatedAt).toISOString()}`,
          },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }
}
