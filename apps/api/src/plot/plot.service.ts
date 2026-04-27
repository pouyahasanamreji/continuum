import { Injectable } from '@nestjs/common';
import { applyPatch, parsePatch } from 'diff';
import { Plot } from './domain/plot';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { PlotServiceError } from '../common/errors/service-errors';
import { PlotRepository } from './infrastructure/persistence/plot.repository';
import { UpdatePlotDto } from './dto/update-plot.dto';
import { DEFAULT_PLOT_TEMPLATE } from './default-template';

const HEADER_FROM_RE = /^---\s+a\/PLOT\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/PLOT\.md(\s|$)/m;

@Injectable()
export class PlotService {
  constructor(
    private readonly repo: PlotRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  defaultTemplate(): string {
    return DEFAULT_PLOT_TEMPLATE;
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
