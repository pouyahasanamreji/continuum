import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

@Injectable()
export class PlotTool implements OnModuleInit {
  private readonly logger = new Logger(PlotTool.name);
  private cached: string | null = null;

  onModuleInit(): void {
    this.cached = this.load();
  }

  private load(): string {
    const envPath = process.env.ORCHESTRATOR_PLOT_PATH;
    if (envPath && existsSync(envPath)) {
      this.logger.log(`Loading PLOT.md from env path ${envPath}`);
      return readFileSync(envPath, 'utf8');
    }
    const bundled = join(__dirname, 'assets', 'PLOT.md');
    this.logger.log(`Loading PLOT.md from bundled asset ${bundled}`);
    return readFileSync(bundled, 'utf8');
  }

  @Tool({
    name: 'plot',
    description:
      'Returns the orchestrator protocol text (PLOT.md). Call this first when entering orchestrator mode.',
    parameters: z.object({}),
  })
  plot() {
    const text = this.cached ?? this.load();
    return { content: [{ type: 'text' as const, text }] };
  }
}
