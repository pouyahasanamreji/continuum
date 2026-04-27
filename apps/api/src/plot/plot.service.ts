import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { applyPatch, parsePatch } from 'diff';
import { Plot } from './domain/plot';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { PlotServiceError } from '../common/errors/service-errors';
import { PlotRepository } from './infrastructure/persistence/plot.repository';
import { UpdatePlotDto } from './dto/update-plot.dto';

const HEADER_FROM_RE = /^---\s+a\/PLOT\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/PLOT\.md(\s|$)/m;

@Injectable()
export class PlotService implements OnModuleInit {
  private readonly logger = new Logger(PlotService.name);
  private cachedTemplate: string | null = null;
  private loadedFrom: string | null = null;

  constructor(
    private readonly repo: PlotRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  onModuleInit(): void {
    this.cachedTemplate = this.loadTemplate();
    this.logger.log(
      `PlotService template loaded ${this.cachedTemplate.length} chars from ${this.loadedFrom}`,
    );
  }

  private loadTemplate(): string {
    const envPath = process.env.ORCHESTRATOR_PLOT_PATH;
    if (!envPath) {
      throw new Error(
        'ORCHESTRATOR_PLOT_PATH is required (canonical PLOT.md path)',
      );
    }
    if (!existsSync(envPath)) {
      throw new Error(
        `ORCHESTRATOR_PLOT_PATH points to a missing file: ${envPath}`,
      );
    }
    this.loadedFrom = envPath;
    return readFileSync(envPath, 'utf8');
  }

  defaultTemplate(): string {
    return this.cachedTemplate ?? this.loadTemplate();
  }

  private resolveProjectIdOrThrow(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new PlotServiceError('project_not_found', projectPath);
    }
    return id;
  }

  findOne(projectPath: string): Plot | null {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findByProjectId(projectId);
  }

  update(updatePlotDto: UpdatePlotDto): Plot {
    const projectId = this.resolveProjectIdOrThrow(updatePlotDto.project);
    const unifiedDiff = updatePlotDto.diff;
    if (!HEADER_FROM_RE.test(unifiedDiff) || !HEADER_TO_RE.test(unifiedDiff)) {
      throw new PlotServiceError('invalid_diff_headers');
    }

    const current = this.repo.findByProjectId(projectId);
    if (!current) throw new PlotServiceError('no_current_content');

    let parsed;
    try {
      parsed = parsePatch(unifiedDiff);
    } catch (err) {
      throw new PlotServiceError(
        'parse_failed',
        err instanceof Error ? err.message : String(err),
      );
    }
    if (!parsed.length)
      throw new PlotServiceError('parse_failed', 'empty patch');

    const patch = parsed[0];
    const updated = applyPatch(current.content, patch, { fuzzFactor: 0 });
    if (updated === false) {
      const firstHunk = patch.hunks[0];
      const detail = firstHunk
        ? `@@ -${firstHunk.oldStart},${firstHunk.oldLines} +${firstHunk.newStart},${firstHunk.newLines} @@`
        : 'no hunks';
      throw new PlotServiceError('hunk_mismatch', detail);
    }

    this.repo.applyDiff(projectId, {
      unifiedDiff,
      newContent: updated,
      now: Date.now(),
    });
    const after = this.repo.findByProjectId(projectId);
    if (!after) throw new PlotServiceError('no_current_content');
    return after;
  }
}
