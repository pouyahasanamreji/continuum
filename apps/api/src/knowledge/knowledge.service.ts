import { Injectable } from '@nestjs/common';
import { applyPatch, parsePatch } from 'diff';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { KnowledgeUpdateError } from '../common/errors/service-errors';
import { KnowledgeRepository } from './infrastructure/persistence/knowledge.repository';

const HEADER_FROM_RE = /^---\s+a\/knowledge\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/knowledge\.md(\s|$)/m;

export interface KnowledgeReadResult {
  content: string;
  updatedAt: Date;
}

export interface KnowledgeUpdateResult {
  updatedAt: Date;
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  private resolveProjectId(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new KnowledgeUpdateError('project_not_found', projectPath);
    }
    return id;
  }

  getAll(projectPath: string): KnowledgeReadResult | null {
    const projectId = this.resolveProjectId(projectPath);
    const k = this.repo.findByProjectId(projectId);
    return k ? { content: k.content, updatedAt: k.updatedAt } : null;
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
    const projectId = this.resolveProjectId(projectPath);
    if (!HEADER_FROM_RE.test(unifiedDiff) || !HEADER_TO_RE.test(unifiedDiff)) {
      throw new KnowledgeUpdateError('invalid_diff_headers');
    }

    const current = this.repo.findByProjectId(projectId);
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
    this.repo.applyDiff(projectId, {
      unifiedDiff,
      newContent: updated,
      now,
    });
    return { updatedAt: new Date(now) };
  }

  set(projectPath: string, content: string): void {
    const projectId = this.resolveProjectId(projectPath);
    this.repo.upsert(projectId, content, Date.now());
  }
}
