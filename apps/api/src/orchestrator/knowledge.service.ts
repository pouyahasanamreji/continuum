import { Injectable } from '@nestjs/common';
import { applyPatch, parsePatch } from 'diff';
import { OrchestratorDbService } from './db.service';
import type { KnowledgeReadResult, KnowledgeUpdateResult } from './types';

const HEADER_FROM_RE = /^---\s+a\/knowledge\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/knowledge\.md(\s|$)/m;

export class KnowledgeUpdateError extends Error {
  constructor(
    public readonly reason:
      | 'invalid_diff_headers'
      | 'parse_failed'
      | 'hunk_mismatch'
      | 'no_current_content'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`knowledge_update failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'KnowledgeUpdateError';
  }
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly dbService: OrchestratorDbService) {}

  private assertProjectExistsInline(projectPath: string): void {
    const row = this.dbService.db
      .prepare<
        [string],
        { _: number }
      >('SELECT 1 AS _ FROM projects WHERE path = ?')
      .get(projectPath);
    if (!row) throw new KnowledgeUpdateError('project_not_found', projectPath);
  }

  getAll(projectPath: string): KnowledgeReadResult | null {
    this.assertProjectExistsInline(projectPath);
    const row = this.dbService.db
      .prepare<
        [string],
        { content: string; updated_at: number }
      >('SELECT content, updated_at FROM knowledge WHERE project_path = ?')
      .get(projectPath);
    return row ? { content: row.content, updatedAt: row.updated_at } : null;
  }

  getSection(projectPath: string, title: string): string | null {
    const all = this.getAll(projectPath);
    if (!all) return null;
    const lines = all.content.split('\n');
    const head = `## ${title}`;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === head) {
        start = i;
        break;
      }
    }
    if (start === -1) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join('\n');
  }

  applyDiff(projectPath: string, unifiedDiff: string): KnowledgeUpdateResult {
    this.assertProjectExistsInline(projectPath);
    if (!HEADER_FROM_RE.test(unifiedDiff) || !HEADER_TO_RE.test(unifiedDiff)) {
      throw new KnowledgeUpdateError('invalid_diff_headers');
    }

    const current = this.getAll(projectPath);
    if (!current) throw new KnowledgeUpdateError('no_current_content');

    let parsed;
    try {
      parsed = parsePatch(unifiedDiff);
    } catch (err) {
      throw new KnowledgeUpdateError(
        'parse_failed',
        err instanceof Error ? err.message : String(err),
      );
    }
    if (!parsed.length)
      throw new KnowledgeUpdateError('parse_failed', 'empty patch');

    const patch = parsed[0];
    const updated = applyPatch(current.content, patch, { fuzzFactor: 0 });
    if (updated === false) {
      const firstHunk = patch.hunks[0];
      const detail = firstHunk
        ? `@@ -${firstHunk.oldStart},${firstHunk.oldLines} +${firstHunk.newStart},${firstHunk.newLines} @@`
        : 'no hunks';
      throw new KnowledgeUpdateError('hunk_mismatch', detail);
    }

    const now = Date.now();
    const db = this.dbService.db;
    const tx = db.transaction(
      (proj: string, content: string, diff: string, ts: number) => {
        db.prepare(
          'INSERT INTO knowledge_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
        ).run(proj, content, diff, ts);
        db.prepare(
          'UPDATE knowledge SET content = ?, updated_at = ? WHERE project_path = ?',
        ).run(content, ts, proj);
      },
    );
    tx.immediate(projectPath, updated, unifiedDiff, now);

    return { updatedAt: now };
  }

  set(projectPath: string, content: string): void {
    this.assertProjectExistsInline(projectPath);
    const now = Date.now();
    this.dbService.db
      .prepare(
        `INSERT INTO knowledge (project_path, content, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(project_path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(projectPath, content, now);
  }
}
