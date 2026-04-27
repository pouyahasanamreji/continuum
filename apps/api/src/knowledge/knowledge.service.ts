import { Injectable } from '@nestjs/common';
import { applyPatch, parsePatch } from 'diff';
import { Knowledge } from './domain/knowledge';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { KnowledgeUpdateError } from '../common/errors/service-errors';
import { KnowledgeRepository } from './infrastructure/persistence/knowledge.repository';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';

const HEADER_FROM_RE = /^---\s+a\/knowledge\.md(\s|$)/m;
const HEADER_TO_RE = /^\+\+\+\s+b\/knowledge\.md(\s|$)/m;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  private resolveProjectIdOrThrow(projectPath: string): number {
    const id = this.projectRepo.findIdByPath(projectPath);
    if (id === null) {
      throw new KnowledgeUpdateError('project_not_found', projectPath);
    }
    return id;
  }

  findOne(projectPath: string): Knowledge | null {
    const projectId = this.resolveProjectIdOrThrow(projectPath);
    return this.repo.findByProjectId(projectId);
  }

  findBySection(projectPath: string, section: string): Knowledge | null {
    const found = this.findOne(projectPath);
    if (!found) return null;
    const lines = found.content.split('\n');
    const head = `## ${section}`;
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
    const sectionText = lines.slice(start, end).join('\n');
    const k = new Knowledge();
    Object.assign(k, found);
    k.content = sectionText;
    return k;
  }

  update(updateKnowledgeDto: UpdateKnowledgeDto): Knowledge {
    const projectId = this.resolveProjectIdOrThrow(updateKnowledgeDto.project);
    const unifiedDiff = updateKnowledgeDto.diff;
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
    const newContent = applyPatch(current.content, patch, { fuzzFactor: 0 });
    if (newContent === false) {
      const firstHunk = patch.hunks[0];
      const detail = firstHunk
        ? `@@ -${firstHunk.oldStart},${firstHunk.oldLines} +${firstHunk.newStart},${firstHunk.newLines} @@`
        : 'no hunks';
      throw new KnowledgeUpdateError('hunk_mismatch', detail);
    }

    this.repo.applyDiff(projectId, {
      unifiedDiff,
      newContent,
      now: Date.now(),
    });
    const after = this.repo.findByProjectId(projectId);
    if (!after) throw new KnowledgeUpdateError('no_current_content');
    return after;
  }
}
