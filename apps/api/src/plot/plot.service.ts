import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { applyPatch, parsePatch } from 'diff';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { PlotServiceError } from '../common/errors/service-errors';
import { PlotRepository } from './infrastructure/persistence/plot.repository';

const HEADER_FROM_RE = /^---\s+a\/PLOT\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/PLOT\.md(\s|$)/m;

export interface PlotReadResult {
  content: string;
  updatedAt: Date;
}

export interface PlotUpdateResult {
  updatedAt: Date;
}

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

  private resolveProjectId(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new PlotServiceError('project_not_found', projectPath);
    }
    return id;
  }

  getForProject(projectPath: string): PlotReadResult {
    const projectId = this.resolveProjectId(projectPath);
    let plot = this.repo.findByProjectId(projectId);
    if (!plot) {
      const now = Date.now();
      this.repo.upsert(projectId, this.defaultTemplate(), now);
      plot = this.repo.findByProjectId(projectId);
      if (!plot) {
        throw new Error(`plot lazy-create failed for project_id=${projectId}`);
      }
    }
    return { content: plot.content, updatedAt: plot.updatedAt };
  }

  applyDiffForProject(
    projectPath: string,
    unifiedDiff: string,
  ): PlotUpdateResult {
    const projectId = this.resolveProjectId(projectPath);
    if (!HEADER_FROM_RE.test(unifiedDiff) || !HEADER_TO_RE.test(unifiedDiff)) {
      throw new PlotServiceError('invalid_diff_headers');
    }

    const current = this.getForProject(projectPath);

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

    const now = Date.now();
    this.repo.applyDiff(projectId, {
      unifiedDiff,
      newContent: updated,
      now,
    });

    return { updatedAt: new Date(now) };
  }
}
