import Database from 'better-sqlite3';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeServiceError } from '../common/errors/service-errors';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { migrate } from '../database/schema';
import { KnowledgeRelationalRepository } from './infrastructure/persistence/relational/repositories/knowledge.repository';
import { ProjectRelationalRepository } from '../project/infrastructure/persistence/relational/repositories/project.repository';
import { AgentRelationalRepository } from '../agent/infrastructure/persistence/relational/repositories/agent.repository';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

const PROJECT_PATH = '/Users/foo/proj';

interface Harness {
  service: KnowledgeService;
  knowledgeRepo: KnowledgeRelationalRepository;
  projectRepo: ProjectRelationalRepository;
  agentRepo: AgentRelationalRepository;
  db: Database.Database;
  agentId: (slug: string) => number;
  seedAgent: (slug: string) => number;
}

function makeHarness(): Harness {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const projectRepo = new ProjectRelationalRepository(dbs);
  const agentRepo = new AgentRelationalRepository(dbs);
  const knowledgeRepo = new KnowledgeRelationalRepository(dbs);

  const projectResult = projectRepo.create({
    path: PROJECT_PATH,
    name: 'proj',
    plotContent: '',
    now: Date.now(),
  });
  if (!projectResult.ok) throw new Error('project setup failed');
  const projectId = projectResult.project.id;

  function seedAgent(slug: string): number {
    const r = agentRepo.create(projectId, {
      slug,
      branch: `feat/${slug}`,
      worktree: `/tmp/wt-${slug}`,
      reservedPaths: [],
      request: 'r',
      plan: 'p',
      implPrompt: 'i',
      coordinationBrief: 'c',
      now: Date.now(),
    });
    if (!r.ok) throw new Error(`agent setup failed: ${slug}`);
    return r.agent.id;
  }

  const service = new KnowledgeService(knowledgeRepo, projectRepo, agentRepo);

  return {
    service,
    knowledgeRepo,
    projectRepo,
    agentRepo,
    db,
    seedAgent,
    agentId: (slug: string) => {
      const a = agentRepo.findByProjectIdAndSlug(projectId, slug);
      if (!a) throw new Error(`agent ${slug} not seeded`);
      return a.id;
    },
  };
}

describe('KnowledgeService.list', () => {
  it('returns [] for project with no knowledge rows', () => {
    const { service } = makeHarness();
    expect(service.list(PROJECT_PATH)).toEqual([]);
  });

  it('throws project_not_found for unknown project', () => {
    const { service } = makeHarness();
    try {
      service.list('/nope');
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('project_not_found');
    }
  });

  it('returns rows in created_at DESC, id ASC order', () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'first',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'two',
      content: 'second',
    });
    // Same-ms inserts: id ASC tiebreaker keeps insert order stable.
    expect(service.list(PROJECT_PATH).map((r) => r.slug)).toEqual([
      'one',
      'two',
    ]);
    // Force a newer created_at on a third row → it sorts ahead of the others.
    const id = (
      db.prepare('SELECT id FROM projects WHERE path = ?').get(PROJECT_PATH) as
        | { id: number }
        | undefined
    )?.id;
    const aId = (
      db
        .prepare('SELECT id FROM agents WHERE project_id = ? AND slug = ?')
        .get(id, 'alpha') as { id: number }
    ).id;
    db.prepare(
      `INSERT INTO knowledge (project_id, agent_id, slug, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, aId, 'three', 'third', Date.now() + 60_000, Date.now() + 60_000);
    expect(service.list(PROJECT_PATH).map((r) => r.slug)).toEqual([
      'three',
      'one',
      'two',
    ]);
  });
});

describe('KnowledgeService.get', () => {
  it('returns null when slug missing', () => {
    const { service } = makeHarness();
    expect(service.get(PROJECT_PATH, 'nothing')).toBeNull();
  });

  it('returns row by slug', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'lesson',
      content: 'body',
    });
    const got = service.get(PROJECT_PATH, 'lesson');
    expect(got?.slug).toBe('lesson');
    expect(got?.content).toBe('body');
  });

  it('throws project_not_found on unknown project', () => {
    const { service } = makeHarness();
    try {
      service.get('/missing', 'x');
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('project_not_found');
    }
  });
});

describe('KnowledgeService.create', () => {
  it('creates row with agent_id resolved from agentSlug', () => {
    const { service, seedAgent, agentId } = makeHarness();
    seedAgent('alpha');
    const k = service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'lesson',
      content: 'body',
    });
    expect(k.slug).toBe('lesson');
    expect(k.agentId).toBe(agentId('alpha'));
  });

  it('throws agent_not_found when agentSlug not in project', () => {
    const { service } = makeHarness();
    try {
      service.create({
        project: PROJECT_PATH,
        agentSlug: 'ghost',
        slug: 'l',
        content: 'b',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('agent_not_found');
    }
  });

  it('throws invalid_slug for bad slug', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    try {
      service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: 'BadSlug',
        content: 'b',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('invalid_slug');
    }
  });

  it('throws slug_conflict on duplicate slug within project', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'a',
    });
    try {
      service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: 'one',
        content: 'b',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('slug_conflict');
    }
  });

  it('throws project_not_found on unknown project', () => {
    const { service } = makeHarness();
    try {
      service.create({
        project: '/missing',
        agentSlug: 'alpha',
        slug: 'one',
        content: 'b',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('project_not_found');
    }
  });
});

describe('KnowledgeService.update', () => {
  it('replaces content (whole-content)', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'old',
    });
    const updated = service.update('one', {
      project: PROJECT_PATH,
      content: 'new',
    });
    expect(updated.content).toBe('new');
  });

  it('reattributes via agentSlug', () => {
    const { service, seedAgent, agentId } = makeHarness();
    seedAgent('alpha');
    seedAgent('beta');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const updated = service.update('one', {
      project: PROJECT_PATH,
      agentSlug: 'beta',
    });
    expect(updated.agentId).toBe(agentId('beta'));
  });

  it('throws no_change on empty patch', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    try {
      service.update('one', { project: PROJECT_PATH });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('no_change');
    }
  });

  it('throws not_found for missing slug', () => {
    const { service } = makeHarness();
    try {
      service.update('ghost', { project: PROJECT_PATH, content: 'x' });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('not_found');
    }
  });

  it('throws agent_not_found when reassign target missing', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    try {
      service.update('one', { project: PROJECT_PATH, agentSlug: 'ghost' });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('agent_not_found');
    }
  });
});

describe('KnowledgeService.remove', () => {
  it('hard-deletes the row', () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    service.remove(PROJECT_PATH, 'one');
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(0);
  });

  it('throws not_found for unknown slug', () => {
    const { service } = makeHarness();
    try {
      service.remove(PROJECT_PATH, 'ghost');
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('not_found');
    }
  });
});

describe('KnowledgeService.search', () => {
  it('returns empty for no matches', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'unique-body',
    });
    expect(service.search(PROJECT_PATH, 'absent', undefined)).toEqual([]);
  });

  it('matches by content substring', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'Cascade pitfall when deleting parents',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'two',
      content: 'unrelated',
    });
    const found = service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('one');
  });

  it('matches by slug substring', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'cascade-rule',
      content: 'body',
    });
    const found = service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
  });

  it('respects limit', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    for (let i = 0; i < 5; i++) {
      service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: `s-${i}`,
        content: `match-${i}`,
      });
    }
    const found = service.search(PROJECT_PATH, 'match', undefined, 2);
    expect(found.length).toBe(2);
  });

  it('clamps limit to max 50', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'match',
    });
    expect(service.search(PROJECT_PATH, 'match', undefined, 9999).length).toBe(
      1,
    );
  });

  it('throws project_not_found for unknown project', () => {
    const { service } = makeHarness();
    try {
      service.search('/missing', 'x', undefined);
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('project_not_found');
    }
  });
});

describe('KnowledgeService kind field', () => {
  it('create stores kind=fundamental when provided explicitly', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const k = service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'rule',
      content: 'binding',
      kind: 'fundamental',
    });
    expect(k.kind).toBe('fundamental');
  });

  it('create defaults kind to situational when omitted', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const k = service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'note',
      content: 'context',
    });
    expect(k.kind).toBe('situational');
  });

  it('update patches kind alone (situational → fundamental)', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const updated = service.update('one', {
      project: PROJECT_PATH,
      kind: 'fundamental',
    });
    expect(updated.kind).toBe('fundamental');
  });

  it('update with same-kind value still flips updated_at', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const created = service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const t0 = created.updatedAt.getTime();
    // Force later timestamp by waiting a millisecond.
    const realNow = Date.now;
    Date.now = () => t0 + 1000;
    try {
      const updated = service.update('one', {
        project: PROJECT_PATH,
        kind: 'situational',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(t0);
    } finally {
      Date.now = realNow;
    }
  });

  it('search with kind:fundamental only returns only fundamentals', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'a',
      kind: 'fundamental',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'b',
      content: 'b',
    });
    const found = service.search(PROJECT_PATH, undefined, 'fundamental');
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('a');
  });

  it('search with q AND kind AND-combines', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'cascade rule',
      kind: 'fundamental',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'b',
      content: 'cascade note',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'c',
      content: 'unrelated',
      kind: 'fundamental',
    });
    const found = service.search(PROJECT_PATH, 'cascade', 'fundamental');
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('a');
  });

  it('search with neither q nor kind throws invalid_query', () => {
    const { service } = makeHarness();
    try {
      service.search(PROJECT_PATH, undefined, undefined);
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('invalid_query');
    }
  });

  it('findManyWithPagination with filters.kind:fundamental returns only fundamentals', () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'x',
      kind: 'fundamental',
    });
    service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'b',
      content: 'y',
    });
    const rows = service.findManyWithPagination({
      project: PROJECT_PATH,
      page: 1,
      limit: 10,
      filters: { kind: 'fundamental' },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].slug).toBe('a');
  });
});
