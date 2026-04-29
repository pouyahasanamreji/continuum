import Database from 'better-sqlite3';
import { AgentService } from './agent.service';
import { AgentServiceError } from '../common/errors/service-errors';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { migrate } from '../database/schema';
import { AgentRelationalRepository } from './infrastructure/persistence/relational/repositories/agent.repository';
import { ProjectRelationalRepository } from '../project/infrastructure/persistence/relational/repositories/project.repository';
import { Agent } from './domain/agent';
import { AgentStatusEnum } from '../agent-statuses/agent-statuses.enum';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

const PROJECT_PATH = '/Users/foo/proj';
const COMMIT_SHA = 'abc1234';

interface Harness {
  service: AgentService;
  agentRepo: AgentRelationalRepository;
  projectRepo: ProjectRelationalRepository;
  db: Database.Database;
  makeAgent: (slug: string, status: AgentStatusEnum) => Agent;
}

function makeHarness(): Harness {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const projectRepo = new ProjectRelationalRepository(dbs);
  const agentRepo = new AgentRelationalRepository(dbs);

  const projectResult = projectRepo.create({
    path: PROJECT_PATH,
    name: 'proj',
    plotContent: '',
    now: Date.now(),
  });
  if (!projectResult.ok) throw new Error('project setup failed');
  const projectId = projectResult.project.id;

  const service = new AgentService(agentRepo, projectRepo);

  function makeAgent(slug: string, status: AgentStatusEnum): Agent {
    const now = Date.now();
    const created = agentRepo.create(projectId, {
      slug,
      branch: `feat/${slug}`,
      worktree: `/tmp/wt-${slug}`,
      reservedPaths: [],
      request: 'r',
      plan: 'initial plan',
      implPrompt: 'initial impl',
      coordinationBrief: 'initial brief',
      now,
    });
    if (!created.ok) throw new Error(`agent setup failed: ${slug}`);
    const id = created.agent.id;
    if (status === 'draft') return created.agent;

    agentRepo.update(id, {
      status: 'active',
      dispatchedAt: now,
      updatedAt: now,
    });
    if (status === 'active') {
      const out = agentRepo.findById(id);
      if (!out) throw new Error('agent missing after activate');
      return out;
    }

    if (status === 'merged') {
      agentRepo.update(id, {
        status: 'merged',
        mergedAt: now,
        mergedCommit: COMMIT_SHA,
        updatedAt: now,
      });
    } else if (status === 'abandoned') {
      agentRepo.update(id, {
        status: 'abandoned',
        abandonedReason: 'cancelled',
        updatedAt: now,
      });
    }

    const out = agentRepo.findById(id);
    if (!out) throw new Error(`agent missing after ${status}`);
    return out;
  }

  return { service, agentRepo, projectRepo, db, makeAgent };
}

describe('AgentService.update — artifact patches', () => {
  it('updates plan on draft agent and bumps updatedAt', () => {
    const { service, makeAgent } = makeHarness();
    const before = makeAgent('a1', 'draft');
    const beforeMs = before.updatedAt.getTime();

    const updated = service.update('a1', {
      project: PROJECT_PATH,
      slug: 'a1',
      plan: 'new plan',
    });

    expect(updated.plan).toBe('new plan');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeMs);
  });

  it('updates plan on active agent', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a2', 'active');

    const updated = service.update('a2', {
      project: PROJECT_PATH,
      slug: 'a2',
      plan: 'new plan',
    });

    expect(updated.plan).toBe('new plan');
    expect(updated.status).toBe('active');
  });

  it('rejects plan update on merged agent with artifacts_frozen', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a3', 'merged');

    expect(() =>
      service.update('a3', {
        project: PROJECT_PATH,
        slug: 'a3',
        plan: 'new plan',
      }),
    ).toThrow(AgentServiceError);

    try {
      service.update('a3', {
        project: PROJECT_PATH,
        slug: 'a3',
        plan: 'new plan',
      });
    } catch (e) {
      const err = e as AgentServiceError;
      expect(err.reason).toBe('artifacts_frozen');
      expect(err.detail).toContain('status=merged');
    }
  });

  it('rejects plan update on abandoned agent with artifacts_frozen', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a4', 'abandoned');

    try {
      service.update('a4', {
        project: PROJECT_PATH,
        slug: 'a4',
        plan: 'new plan',
      });
      fail('expected throw');
    } catch (e) {
      const err = e as AgentServiceError;
      expect(err.reason).toBe('artifacts_frozen');
      expect(err.detail).toContain('status=abandoned');
    }
  });

  it('applies status=active and plan together on draft agent', () => {
    const { service, makeAgent, agentRepo } = makeHarness();
    const before = makeAgent('a5', 'draft');
    expect(before.dispatchedAt).toBeNull();

    const updated = service.update('a5', {
      project: PROJECT_PATH,
      slug: 'a5',
      status: 'active',
      plan: 'new',
    });

    expect(updated.plan).toBe('new');
    expect(updated.status).toBe('active');
    expect(updated.dispatchedAt).not.toBeNull();
    const reloaded = agentRepo.findById(updated.id);
    expect(reloaded?.plan).toBe('new');
  });

  it('rejects status=merged + plan on active agent', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a6', 'active');

    try {
      service.update('a6', {
        project: PROJECT_PATH,
        slug: 'a6',
        status: 'merged',
        mergedCommit: COMMIT_SHA,
        plan: 'new',
      });
      fail('expected throw');
    } catch (e) {
      const err = e as AgentServiceError;
      expect(err.reason).toBe('artifacts_frozen');
      expect(err.detail).toContain('status=merged');
    }
  });

  it('rejects status=abandoned + plan on active agent', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a7', 'active');

    try {
      service.update('a7', {
        project: PROJECT_PATH,
        slug: 'a7',
        status: 'abandoned',
        abandonedReason: 'cancelled',
        plan: 'new',
      });
      fail('expected throw');
    } catch (e) {
      const err = e as AgentServiceError;
      expect(err.reason).toBe('artifacts_frozen');
      expect(err.detail).toContain('status=abandoned');
    }
  });

  it('persists plan, implPrompt, and coordinationBrief together on active', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a8', 'active');

    const updated = service.update('a8', {
      project: PROJECT_PATH,
      slug: 'a8',
      plan: 'p2',
      implPrompt: 'i2',
      coordinationBrief: 'c2',
    });

    expect(updated.plan).toBe('p2');
    expect(updated.implPrompt).toBe('i2');
    expect(updated.coordinationBrief).toBe('c2');
  });

  it('allows mergedCommit-only patch on merged agent (legacy branch)', () => {
    const { service, makeAgent } = makeHarness();
    makeAgent('a9', 'merged');
    const newSha = 'def5678';

    const updated = service.update('a9', {
      project: PROJECT_PATH,
      slug: 'a9',
      mergedCommit: newSha,
    });

    expect(updated.status).toBe('merged');
    expect(updated.mergedCommit).toBe(newSha);
  });
});
