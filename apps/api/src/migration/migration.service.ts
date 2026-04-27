import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { ProjectService } from '../project/project.service';
import { ProjectRepository } from '../project/infrastructure/persistence/project.repository';
import { PlotService } from '../plot/plot.service';
import { AgentService } from '../agent/agent.service';
import { SLUG_RE } from '../common/slug';
import {
  dateStringToMs,
  parseAgentDoc,
  ParsedAgent,
} from './domain/state-parser';

export interface MigrationInput {
  path: string;
  name?: string;
  plotContent?: string;
  knowledgeContent?: string;
  agents?: Array<{ slug: string; content: string }>;
}

export interface MigrationResult {
  projectPath: string;
  created: boolean;
  plotUpdated: boolean;
  knowledgeUpdated: boolean;
  agentsUpserted: number;
  agentsSkipped: number;
  warnings: string[];
}

@Injectable()
export class MigrationService {
  constructor(
    private readonly dbs: OrchestratorDbService,
    private readonly projects: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly plot: PlotService,
    private readonly agents: AgentService,
  ) {}

  migrate(input: MigrationInput): MigrationResult {
    const projectPath = this.projects.canonicalize(input.path);

    const name = (input.name ?? basename(projectPath)).trim();
    if (!name) {
      throw new Error('invalid_name: empty after trim');
    }
    if (/[\r\n]/.test(name)) {
      throw new Error('invalid_name: newlines not allowed');
    }

    const warnings: string[] = [];

    const validAgents: Array<{ slug: string; parsed: ParsedAgent }> = [];
    let agentsSkipped = 0;
    for (const a of input.agents ?? []) {
      if (!a || typeof a.slug !== 'string' || typeof a.content !== 'string') {
        agentsSkipped++;
        warnings.push(`agent skipped: malformed entry`);
        continue;
      }
      if (!SLUG_RE.test(a.slug)) {
        agentsSkipped++;
        warnings.push(`agent "${a.slug}" skipped: invalid slug`);
        continue;
      }
      if (a.content.trim().length === 0) {
        agentsSkipped++;
        warnings.push(`agent "${a.slug}" skipped: empty content`);
        continue;
      }
      const { parsed, warnings: w } = parseAgentDoc(a.content);
      for (const m of w) warnings.push(`agent "${a.slug}": ${m}`);
      validAgents.push({ slug: a.slug, parsed });
    }

    const db = this.dbs.db;
    const now = Date.now();

    let created = false;
    let plotUpdated = false;
    let knowledgeUpdated = false;
    let agentsUpserted = 0;

    const tx = db.transaction(() => {
      let projectId = this.projectRepo.findIdByPath(projectPath);

      if (projectId === null) {
        created = true;
        const info = db
          .prepare(
            'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
          )
          .run(projectPath, name, now, now);
        projectId = Number(info.lastInsertRowid);
        db.prepare(
          'INSERT INTO plots (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
        ).run(projectId, this.plot.defaultTemplate(), now, now);
        db.prepare(
          'INSERT INTO knowledge (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
        ).run(projectId, '', now, now);
      }

      if (input.plotContent !== undefined) {
        const current = db
          .prepare<
            [number],
            { content: string }
          >('SELECT content FROM plots WHERE project_id = ? AND deleted_at IS NULL')
          .get(projectId);
        const cur = current?.content ?? '';
        if (cur !== input.plotContent) {
          db.prepare(
            'INSERT INTO plot_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
          ).run(projectId, input.plotContent, '[migration]', now);
          db.prepare(
            'UPDATE plots SET content = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
          ).run(input.plotContent, now, projectId);
          plotUpdated = true;
        }
      }

      if (input.knowledgeContent !== undefined) {
        const current = db
          .prepare<
            [number],
            { content: string }
          >('SELECT content FROM knowledge WHERE project_id = ? AND deleted_at IS NULL')
          .get(projectId);
        const cur = current?.content ?? '';
        if (cur !== input.knowledgeContent) {
          db.prepare(
            'INSERT INTO knowledge_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
          ).run(projectId, input.knowledgeContent, '[migration]', now);
          db.prepare(
            'UPDATE knowledge SET content = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
          ).run(input.knowledgeContent, now, projectId);
          knowledgeUpdated = true;
        }
      }

      for (const { slug, parsed } of validAgents) {
        const status = parsed.status ?? 'draft';
        const dispatchedAt = dateStringToMs(parsed.dispatchedAt);
        const mergedAt =
          dateStringToMs(parsed.mergedAt) ??
          (status === 'merged' ? (dispatchedAt ?? now) : null);
        const mergedCommit =
          parsed.mergedCommit && parsed.mergedCommit.length >= 7
            ? parsed.mergedCommit.slice(0, 40)
            : null;
        this.agents.upsertFromMigration(projectPath, slug, {
          branch: parsed.branch ?? '',
          worktree: parsed.worktree ?? '',
          reservedPaths: parsed.reservedPaths ?? [],
          request: parsed.request,
          plan: parsed.plan,
          implPrompt: parsed.implPrompt,
          coordinationBrief: parsed.coordinationBrief,
          postMergeNotes: parsed.postMergeNotes,
          status,
          dispatchedAt,
          mergedAt,
          mergedCommit,
          now,
        });
        agentsUpserted++;
      }
    });
    tx.immediate();

    return {
      projectPath,
      created,
      plotUpdated,
      knowledgeUpdated,
      agentsUpserted,
      agentsSkipped,
      warnings,
    };
  }
}
