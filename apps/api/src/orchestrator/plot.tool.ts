import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { PlotService } from './plot.service';

@Injectable()
export class PlotTool {
  constructor(private readonly plot: PlotService) {}

  @Tool({
    name: 'plot',
    description:
      'Returns the orchestrator protocol text (PLOT.md). Call this first when entering orchestrator mode.',
    parameters: z.object({}),
  })
  getPlot() {
    return { content: [{ type: 'text' as const, text: this.plot.get() }] };
  }
}
