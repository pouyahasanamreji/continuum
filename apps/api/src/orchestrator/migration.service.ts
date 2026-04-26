import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { OrchestratorDbService } from './db.service';
import { ProjectService } from './project.service';
import { PlotService } from './plot.service';
import { SLUG_RE } from './agent.service';
import { dateStringToMs, parseAgentDoc } from './state-parser';

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

interface AgentRowExisting {
  created_at: number;
}

@Injectable()
export class MigrationService {
  constructor(
    private readonly dbs: OrchestratorDbService,
    private readonly projects: ProjectService,
    private readonly plot: PlotService,
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

    const validAgents: Array<{
      slug: string;
      parsed: ReturnType<typeof parseAgentDoc>['parsed'];
    }> = [];
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

    const upsertAgent = db.prepare(`
      INSERT INTO agents (
        project_path, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, dispatched_at, updated_at, merged_at, merged_commit, abandoned_reason
      ) VALUES (
        @project_path, @slug, @status, @branch, @worktree, @reserved_paths_json,
        @request, @plan, @impl_prompt, @coordination_brief, @post_merge_notes,
        @created_at, @dispatched_at, @updated_at, @merged_at, @merged_commit, @abandoned_reason
      )
      ON CONFLICT(project_path, slug) DO UPDATE SET
        status = excluded.status,
        branch = excluded.branch,
        worktree = excluded.worktree,
        reserved_paths_json = excluded.reserved_paths_json,
        request = excluded.request,
        plan = excluded.plan,
        impl_prompt = excluded.impl_prompt,
        coordination_brief = excluded.coordination_brief,
        post_merge_notes = excluded.post_merge_notes,
        dispatched_at = excluded.dispatched_at,
        updated_at = excluded.updated_at,
        merged_at = excluded.merged_at,
        merged_commit = excluded.merged_commit,
        abandoned_reason = excluded.abandoned_reason
    `);

    const tx = db.transaction(() => {
      const existingProject = db
        .prepare<
          [string],
          { _: number }
        >('SELECT 1 AS _ FROM projects WHERE path = ?')
        .get(projectPath);

      if (!existingProject) {
        created = true;
        db.prepare(
          'INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        ).run(projectPath, name, now, now);
        db.prepare(
          'INSERT INTO plots (project_path, content, updated_at) VALUES (?, ?, ?)',
        ).run(projectPath, this.plot.defaultTemplate(), now);
        db.prepare(
          'INSERT INTO knowledge (project_path, content, updated_at) VALUES (?, ?, ?)',
        ).run(projectPath, '', now);
      }

      if (input.plotContent !== undefined) {
        const current = db
          .prepare<
            [string],
            { content: string }
          >('SELECT content FROM plots WHERE project_path = ?')
          .get(projectPath);
        const cur = current?.content ?? '';
        if (cur !== input.plotContent) {
          db.prepare(
            'INSERT INTO plot_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
          ).run(projectPath, input.plotContent, '[migration]', now);
          db.prepare(
            'UPDATE plots SET content = ?, updated_at = ? WHERE project_path = ?',
          ).run(input.plotContent, now, projectPath);
          plotUpdated = true;
        }
      }

      if (input.knowledgeContent !== undefined) {
        const current = db
          .prepare<
            [string],
            { content: string }
          >('SELECT content FROM knowledge WHERE project_path = ?')
          .get(projectPath);
        const cur = current?.content ?? '';
        if (cur !== input.knowledgeContent) {
          db.prepare(
            'INSERT INTO knowledge_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
          ).run(projectPath, input.knowledgeContent, '[migration]', now);
          db.prepare(
            'UPDATE knowledge SET content = ?, updated_at = ? WHERE project_path = ?',
          ).run(input.knowledgeContent, now, projectPath);
          knowledgeUpdated = true;
        }
      }

      for (const { slug, parsed } of validAgents) {
        const existing = db
          .prepare<
            [string, string],
            AgentRowExisting
          >('SELECT created_at FROM agents WHERE project_path = ? AND slug = ?')
          .get(projectPath, slug);

        const status = parsed.status ?? 'draft';
        const dispatchedAt = dateStringToMs(parsed.dispatchedAt);
        const mergedAt =
          dateStringToMs(parsed.mergedAt) ??
          (status === 'merged' ? (dispatchedAt ?? now) : null);
        const mergedCommit =
          parsed.mergedCommit && parsed.mergedCommit.length >= 7
            ? parsed.mergedCommit.slice(0, 40)
            : null;

        upsertAgent.run({
          project_path: projectPath,
          slug,
          status,
          branch: parsed.branch ?? '',
          worktree: parsed.worktree ?? '',
          reserved_paths_json: JSON.stringify(parsed.reservedPaths ?? []),
          request: parsed.request,
          plan: parsed.plan,
          impl_prompt: parsed.implPrompt,
          coordination_brief: parsed.coordinationBrief,
          post_merge_notes: parsed.postMergeNotes,
          created_at: existing?.created_at ?? dispatchedAt ?? now,
          dispatched_at: dispatchedAt,
          updated_at: now,
          merged_at: mergedAt,
          merged_commit: mergedCommit,
          abandoned_reason: null,
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
