import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { applyPatch, parsePatch } from 'diff';
import { OrchestratorDbService } from './db.service';
import type { PlotReadResult, PlotUpdateResult } from './types';

const HEADER_FROM_RE = /^---\s+a\/PLOT\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/PLOT\.md(\s|$)/m;

export class PlotServiceError extends Error {
  constructor(
    public readonly reason:
      | 'invalid_diff_headers'
      | 'parse_failed'
      | 'hunk_mismatch'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`plot operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'PlotServiceError';
  }
}

@Injectable()
export class PlotService implements OnModuleInit {
  private readonly logger = new Logger(PlotService.name);
  private cachedTemplate: string | null = null;
  private loadedFrom: string | null = null;

  constructor(private readonly dbService: OrchestratorDbService) {}

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

  private assertProjectExistsInline(projectPath: string): void {
    const row = this.dbService.db
      .prepare<
        [string],
        { _: number }
      >('SELECT 1 AS _ FROM projects WHERE path = ?')
      .get(projectPath);
    if (!row) throw new PlotServiceError('project_not_found', projectPath);
  }

  getForProject(projectPath: string): PlotReadResult {
    this.assertProjectExistsInline(projectPath);
    const row = this.dbService.db
      .prepare<
        [string],
        { content: string; updated_at: number }
      >('SELECT content, updated_at FROM plots WHERE project_path = ?')
      .get(projectPath);
    if (!row) {
      const now = Date.now();
      const content = this.defaultTemplate();
      this.dbService.db
        .prepare(
          'INSERT INTO plots (project_path, content, updated_at) VALUES (?, ?, ?)',
        )
        .run(projectPath, content, now);
      return { content, updatedAt: now };
    }
    return { content: row.content, updatedAt: row.updated_at };
  }

  applyDiffForProject(
    projectPath: string,
    unifiedDiff: string,
  ): PlotUpdateResult {
    this.assertProjectExistsInline(projectPath);
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
    const db = this.dbService.db;
    const tx = db.transaction(
      (proj: string, content: string, diff: string, ts: number) => {
        db.prepare(
          'INSERT INTO plot_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
        ).run(proj, content, diff, ts);
        db.prepare(
          'UPDATE plots SET content = ?, updated_at = ? WHERE project_path = ?',
        ).run(content, ts, proj);
      },
    );
    tx.immediate(projectPath, updated, unifiedDiff, now);

    return { updatedAt: now };
  }
}
