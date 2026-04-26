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
      | 'no_current_content',
    public readonly detail?: string,
  ) {
    super(`knowledge_update failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'KnowledgeUpdateError';
  }
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly dbService: OrchestratorDbService) {}

  getAll(): KnowledgeReadResult | null {
    const row = this.dbService.db
      .prepare<
        unknown[],
        { content: string; updated_at: number }
      >('SELECT content, updated_at FROM knowledge WHERE id = 1')
      .get();
    return row ? { content: row.content, updatedAt: row.updated_at } : null;
  }

  getSection(title: string): string | null {
    const all = this.getAll();
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

  applyDiff(unifiedDiff: string): KnowledgeUpdateResult {
    if (!HEADER_FROM_RE.test(unifiedDiff) || !HEADER_TO_RE.test(unifiedDiff)) {
      throw new KnowledgeUpdateError('invalid_diff_headers');
    }

    const current = this.getAll();
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
    const tx = db.transaction((content: string, diff: string, ts: number) => {
      db.prepare(
        'INSERT INTO knowledge_history (content, applied_diff, created_at) VALUES (?, ?, ?)',
      ).run(content, diff, ts);
      db.prepare(
        'UPDATE knowledge SET content = ?, updated_at = ? WHERE id = 1',
      ).run(content, ts);
    });
    tx.immediate(updated, unifiedDiff, now);

    return { updatedAt: now };
  }

  set(content: string): void {
    const now = Date.now();
    this.dbService.db
      .prepare(
        `INSERT INTO knowledge (id, content, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(content, now);
  }
}
