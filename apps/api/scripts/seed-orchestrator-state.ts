import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { migrate } from '../src/database/schema';
import {
  dateStringToMs,
  parseAgentDoc,
  stripBackticks,
} from '../src/migration/domain/state-parser';

const ORCHESTRATOR_ROOT =
  process.env.ORCHESTRATOR_ROOT ?? '/Users/h.amreji/Pers/continuum';
const STATE_DIR = join(ORCHESTRATOR_ROOT, '.orchestrator');
const PLOT_PATH =
  process.env.ORCHESTRATOR_PLOT_PATH ?? join(ORCHESTRATOR_ROOT, 'PLOT.md');
const DB_PATH = process.env.ORCHESTRATOR_DB_PATH ?? '/data/orchestrator.db';
const PROJECT_PATH = ORCHESTRATOR_ROOT;
const PROJECT_NAME = basename(ORCHESTRATOR_ROOT);

interface RegistryEntry {
  status: string;
  reservedPaths: string[];
  slug: string;
}

function warn(msg: string): void {
  console.warn(`[seed] WARN: ${msg}`);
}

function log(msg: string): void {
  console.log(`[seed] ${msg}`);
}

function parseRegistry(text: string): RegistryEntry[] {
  const lines = text.split('\n');
  const entries: RegistryEntry[] = [];
  let inTable = false;
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.startsWith('|')) {
      inTable = false;
      headerSeen = false;
      continue;
    }
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    if (!headerSeen) {
      if (cells[0]?.toLowerCase() === 'status') {
        headerSeen = true;
      }
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (cells.length < 5) continue;
    const status = cells[0];
    const reservedRaw = cells[3];
    const detail = cells[4];
    const linkMatch = detail.match(/\[([^\]]+)\]\(agents\/([^)]+)\)/);
    if (!linkMatch) {
      warn(`registry row missing agent link: ${line}`);
      continue;
    }
    const slug = linkMatch[1];
    const reservedPaths =
      reservedRaw === '(released)' || reservedRaw === ''
        ? []
        : reservedRaw
            .split(',')
            .map((p) => stripBackticks(p))
            .filter((p) => p.length > 0);
    entries.push({ status, reservedPaths, slug });
  }
  return entries;
}

function main(): void {
  if (!existsSync(STATE_DIR)) {
    console.error(`[seed] state dir not found: ${STATE_DIR}`);
    process.exit(1);
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);

  const knowledgePath = join(STATE_DIR, 'knowledge.md');
  if (!existsSync(knowledgePath)) {
    warn(`knowledge.md missing at ${knowledgePath}`);
  }
  const knowledgeContent = existsSync(knowledgePath)
    ? readFileSync(knowledgePath, 'utf8')
    : '';

  if (!existsSync(PLOT_PATH)) {
    warn(`PLOT.md missing at ${PLOT_PATH}`);
  }
  const plotContent = existsSync(PLOT_PATH)
    ? readFileSync(PLOT_PATH, 'utf8')
    : '';

  const registryPath = join(STATE_DIR, 'REGISTRY.md');
  if (!existsSync(registryPath)) {
    warn(`REGISTRY.md missing at ${registryPath}`);
  }
  const registryEntries = existsSync(registryPath)
    ? parseRegistry(readFileSync(registryPath, 'utf8'))
    : [];
  log(`parsed ${registryEntries.length} registry rows`);

  const agentsDir = join(STATE_DIR, 'agents');
  const agentDocs: {
    entry: RegistryEntry;
    doc: ReturnType<typeof parseAgentDoc>['parsed'];
  }[] = [];
  for (const entry of registryEntries) {
    const fp = join(agentsDir, `${entry.slug}.md`);
    if (!existsSync(fp)) {
      warn(`agent doc missing: ${fp}`);
      continue;
    }
    const { parsed, warnings } = parseAgentDoc(readFileSync(fp, 'utf8'));
    for (const w of warnings) warn(`agent ${entry.slug}: ${w}`);
    agentDocs.push({ entry, doc: parsed });
  }

  const orphans = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter(
        (f) =>
          f.endsWith('.md') &&
          !registryEntries.some((e) => `${e.slug}.md` === f),
      )
    : [];
  for (const f of orphans) warn(`agent doc not in registry: ${f}`);

  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    ).run(PROJECT_PATH, PROJECT_NAME, now, now);

    db.prepare(
      `INSERT INTO plots (project_path, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(project_path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    ).run(PROJECT_PATH, plotContent, now);

    db.prepare(
      `INSERT INTO knowledge (project_path, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(project_path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    ).run(PROJECT_PATH, knowledgeContent, now);

    const upsert = db.prepare(`
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

    for (const { entry, doc } of agentDocs) {
      const status = (doc.status ?? entry.status).toLowerCase();
      if (!['draft', 'active', 'merged', 'abandoned'].includes(status)) {
        warn(
          `agent ${entry.slug} has invalid status "${status}", coercing to draft`,
        );
      }
      const validStatus = ['draft', 'active', 'merged', 'abandoned'].includes(
        status,
      )
        ? status
        : 'draft';

      const dispatchedAt = dateStringToMs(doc.dispatchedAt);
      const mergedCommit =
        doc.mergedCommit && doc.mergedCommit.length >= 7
          ? doc.mergedCommit.slice(0, 40)
          : null;
      const mergedAt = validStatus === 'merged' ? (dispatchedAt ?? now) : null;

      upsert.run({
        project_path: PROJECT_PATH,
        slug: entry.slug,
        status: validStatus,
        branch: doc.branch ?? '',
        worktree: doc.worktree ?? '',
        reserved_paths_json: JSON.stringify(entry.reservedPaths),
        request: doc.request,
        plan: doc.plan,
        impl_prompt: doc.implPrompt,
        coordination_brief: doc.coordinationBrief,
        post_merge_notes: doc.postMergeNotes,
        created_at: dispatchedAt ?? now,
        dispatched_at: dispatchedAt,
        updated_at: now,
        merged_at: mergedAt,
        merged_commit: mergedCommit,
        abandoned_reason: null,
      });
      log(`upserted agent ${entry.slug} (status=${validStatus})`);
    }
  });
  tx.immediate();

  log(
    `seeded 1 project, plot=${plotContent.length} chars, knowledge=${knowledgeContent.length} chars, agents=${agentDocs.length}`,
  );
  db.close();
  log(`seed complete -> ${resolve(DB_PATH)}`);
}

main();
