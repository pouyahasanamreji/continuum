import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class PlotService implements OnModuleInit {
  private readonly logger = new Logger(PlotService.name);
  private cached: string | null = null;
  private loadedFrom: string | null = null;

  onModuleInit(): void {
    this.cached = this.load();
    this.logger.log(
      `PlotService loaded ${this.cached.length} chars from ${this.loadedFrom}`,
    );
  }

  private load(): string {
    const envPath = process.env.ORCHESTRATOR_PLOT_PATH;
    if (envPath && existsSync(envPath)) {
      this.loadedFrom = envPath;
      return readFileSync(envPath, 'utf8');
    }
    const bundled = join(__dirname, 'assets', 'PLOT.md');
    this.loadedFrom = bundled;
    return readFileSync(bundled, 'utf8');
  }

  get(): string {
    return this.cached ?? this.load();
  }
}
