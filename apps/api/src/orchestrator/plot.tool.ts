import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { PlotService, PlotServiceError } from './plot.service';

function toolError(err: unknown) {
  const msg =
    err instanceof PlotServiceError
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
export class PlotTool {
  constructor(private readonly plot: PlotService) {}

  @Tool({
    name: 'plot',
    description:
      'Returns the orchestrator protocol text (PLOT.md) for the given project. Call this first when entering orchestrator mode. `project` MUST be the canonical absolute path of the working tree (your `pwd`).',
    parameters: z.object({ project: z.string() }),
  })
  getPlot(args: { project: string }) {
    try {
      const result = this.plot.getForProject(args.project);
      return { content: [{ type: 'text' as const, text: result.content }] };
    } catch (e) {
      return toolError(e);
    }
  }

  @Tool({
    name: 'plot_update',
    description:
      'Apply a unified-diff (git-format) to the project PLOT.md. Diff MUST include `--- a/PLOT.md` and `+++ b/PLOT.md` headers. Hunks must match current content with zero fuzz — get-edit-diff loop on mismatch.',
    parameters: z.object({
      project: z.string(),
      diff: z.string().min(1),
    }),
  })
  plotUpdate(args: { project: string; diff: string }) {
    try {
      const result = this.plot.applyDiffForProject(args.project, args.diff);
      return {
        content: [
          {
            type: 'text' as const,
            text: `PLOT.md updated at ${new Date(result.updatedAt).toISOString()}`,
          },
        ],
      };
    } catch (e) {
      return toolError(e);
    }
  }
}
