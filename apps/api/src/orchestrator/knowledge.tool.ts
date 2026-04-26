import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { KnowledgeService } from './knowledge.service';

@Injectable()
export class KnowledgeTool {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Tool({
    name: 'knowledge_get',
    description:
      'Read the orchestrator knowledge document. Optional `section` arg returns only that ## section.',
    parameters: z.object({ section: z.string().optional() }),
  })
  knowledgeGet(args: { section?: string }) {
    if (args.section) {
      const section = this.knowledge.getSection(args.section);
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
    const all = this.knowledge.getAll();
    if (!all) {
      return {
        content: [
          { type: 'text' as const, text: 'Knowledge document is empty.' },
        ],
        isError: true,
      };
    }
    return { content: [{ type: 'text' as const, text: all.content }] };
  }

  @Tool({
    name: 'knowledge_update',
    description:
      'Apply a unified-diff (git-format) to knowledge.md. Diff MUST include `--- a/knowledge.md` and `+++ b/knowledge.md` headers. Hunks must match current content with zero fuzz — get-edit-diff loop on mismatch.',
    parameters: z.object({ diff: z.string().min(1) }),
  })
  knowledgeUpdate(args: { diff: string }) {
    const result = this.knowledge.applyDiff(args.diff);
    return {
      content: [
        {
          type: 'text' as const,
          text: `knowledge.md updated at ${new Date(result.updatedAt).toISOString()}`,
        },
      ],
    };
  }
}
