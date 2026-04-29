import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeServiceError } from '../common/errors/service-errors';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { migrate } from '../database/schema';
import { KnowledgeRelationalRepository } from './infrastructure/persistence/relational/repositories/knowledge.repository';
import { RelationalKnowledgeVectorRepository } from './infrastructure/persistence/relational/repositories/relational-knowledge-vector.repository';
import { ProjectRelationalRepository } from '../project/infrastructure/persistence/relational/repositories/project.repository';
import { AgentRelationalRepository } from '../agent/infrastructure/persistence/relational/repositories/agent.repository';
import { EmbedderService } from '../embedder/embedder.service';
import { EmbedderError } from '../embedder/embedder.error';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

function loadVec(db: Database.Database): void {
  if (typeof (sqliteVec as { load?: unknown }).load === 'function') {
    (sqliteVec as { load: (d: Database.Database) => void }).load(db);
  } else {
    db.loadExtension(
      (sqliteVec as { getLoadablePath: () => string }).getLoadablePath(),
    );
  }
}

const PROJECT_PATH = '/Users/foo/proj';

interface Harness {
  service: KnowledgeService;
  knowledgeRepo: KnowledgeRelationalRepository;
  vecRepo: RelationalKnowledgeVectorRepository;
  projectRepo: ProjectRelationalRepository;
  agentRepo: AgentRelationalRepository;
  embedder: { embed: jest.Mock };
  db: Database.Database;
  agentId: (slug: string) => number;
  seedAgent: (slug: string) => number;
}

function makeHarness(): Harness {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  loadVec(db);
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const projectRepo = new ProjectRelationalRepository(dbs);
  const agentRepo = new AgentRelationalRepository(dbs);
  const knowledgeRepo = new KnowledgeRelationalRepository(dbs);
  const vecRepo = new RelationalKnowledgeVectorRepository(dbs);

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

  const embedder = {
    embed: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
  };
  const service = new KnowledgeService(
    knowledgeRepo,
    projectRepo,
    agentRepo,
    embedder as unknown as EmbedderService,
    vecRepo,
  );

  return {
    service,
    knowledgeRepo,
    vecRepo,
    projectRepo,
    agentRepo,
    embedder,
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

  it('returns rows in created_at DESC, id ASC order', async () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    const realNow = Date.now;
    const frozen = realNow();
    Date.now = () => frozen;
    try {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: 'one',
        content: 'first',
      });
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: 'two',
        content: 'second',
      });
    } finally {
      Date.now = realNow;
    }
    expect(service.list(PROJECT_PATH).map((r) => r.slug)).toEqual([
      'one',
      'two',
    ]);
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

  it('returns row by slug', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
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
  it('creates row with agent_id resolved from agentSlug', async () => {
    const { service, seedAgent, agentId } = makeHarness();
    seedAgent('alpha');
    const k = await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'lesson',
      content: 'body',
    });
    expect(k.slug).toBe('lesson');
    expect(k.agentId).toBe(agentId('alpha'));
  });

  it('throws agent_not_found when agentSlug not in project', async () => {
    const { service } = makeHarness();
    try {
      await service.create({
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

  it('throws invalid_slug for bad slug', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    try {
      await service.create({
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

  it('throws slug_conflict on duplicate slug within project', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'a',
    });
    try {
      await service.create({
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

  it('throws project_not_found on unknown project', async () => {
    const { service } = makeHarness();
    try {
      await service.create({
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
  it('replaces content (whole-content)', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'old',
    });
    const updated = await service.update('one', {
      project: PROJECT_PATH,
      content: 'new',
    });
    expect(updated.content).toBe('new');
  });

  it('reattributes via agentSlug', async () => {
    const { service, seedAgent, agentId } = makeHarness();
    seedAgent('alpha');
    seedAgent('beta');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const updated = await service.update('one', {
      project: PROJECT_PATH,
      agentSlug: 'beta',
    });
    expect(updated.agentId).toBe(agentId('beta'));
  });

  it('throws no_change on empty patch', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    try {
      await service.update('one', { project: PROJECT_PATH });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('no_change');
    }
  });

  it('throws not_found for missing slug', async () => {
    const { service } = makeHarness();
    try {
      await service.update('ghost', { project: PROJECT_PATH, content: 'x' });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('not_found');
    }
  });

  it('throws agent_not_found when reassign target missing', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    try {
      await service.update('one', {
        project: PROJECT_PATH,
        agentSlug: 'ghost',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('agent_not_found');
    }
  });
});

describe('KnowledgeService.remove', () => {
  it('hard-deletes the row', async () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    await service.create({
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
  it('returns empty for no matches', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'unique-body',
    });
    expect(service.search(PROJECT_PATH, 'absent', undefined)).toEqual([]);
  });

  it('matches by content substring', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'Cascade pitfall when deleting parents',
    });
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'two',
      content: 'unrelated',
    });
    const found = service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('one');
  });

  it('matches by slug substring', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'cascade-rule',
      content: 'body',
    });
    const found = service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
  });

  it('respects limit', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    for (let i = 0; i < 5; i++) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: `s-${i}`,
        content: `match-${i}`,
      });
    }
    const found = service.search(PROJECT_PATH, 'match', undefined, 2);
    expect(found.length).toBe(2);
  });

  it('clamps limit to max 50', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
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
  it('create stores kind=fundamental when provided explicitly', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const k = await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'rule',
      content: 'binding',
      kind: 'fundamental',
    });
    expect(k.kind).toBe('fundamental');
  });

  it('create defaults kind to situational when omitted', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const k = await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'note',
      content: 'context',
    });
    expect(k.kind).toBe('situational');
  });

  it('update patches kind alone (situational → fundamental)', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const updated = await service.update('one', {
      project: PROJECT_PATH,
      kind: 'fundamental',
    });
    expect(updated.kind).toBe('fundamental');
  });

  it('update with same-kind value still flips updated_at', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    const created = await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    const t0 = created.updatedAt.getTime();
    const realNow = Date.now;
    Date.now = () => t0 + 1000;
    try {
      const updated = await service.update('one', {
        project: PROJECT_PATH,
        kind: 'situational',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(t0);
    } finally {
      Date.now = realNow;
    }
  });

  it('search with kind:fundamental only returns only fundamentals', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'a',
      kind: 'fundamental',
    });
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'b',
      content: 'b',
    });
    const found = service.search(PROJECT_PATH, undefined, 'fundamental');
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('a');
  });

  it('search with q AND kind AND-combines', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'cascade rule',
      kind: 'fundamental',
    });
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'b',
      content: 'cascade note',
    });
    await service.create({
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

  it('findManyWithPagination with filters.kind:fundamental returns only fundamentals', async () => {
    const { service, seedAgent } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'x',
      kind: 'fundamental',
    });
    await service.create({
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

describe('KnowledgeService vectorization', () => {
  it('create with embedder stubbed → row exists in knowledge_vec', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'body',
    });
    expect(embedder.embed).toHaveBeenCalledWith('body');
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(1);
  });

  it('create with embedder rejecting → no throw, knowledge row exists, vec absent', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    embedder.embed.mockRejectedValueOnce(
      new EmbedderError('upstream_failed', 'econnrefused'),
    );
    const k = await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'body',
    });
    expect(k.slug).toBe('one');
    const krow = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge').get() as { c: number }
    ).c;
    expect(krow).toBe(1);
    const vrow = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(vrow).toBe(0);
  });

  it('update with content patch → vec row replaced', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    embedder.embed.mockResolvedValueOnce(new Array(768).fill(0.1));
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'old',
    });
    const hexBefore = (
      db
        .prepare('SELECT substr(hex(embedding), 1, 8) AS h FROM knowledge_vec')
        .get() as { h: string }
    ).h;
    embedder.embed.mockResolvedValueOnce(new Array(768).fill(0.9));
    await service.update('one', {
      project: PROJECT_PATH,
      content: 'new',
    });
    expect(embedder.embed).toHaveBeenCalledTimes(2);
    expect(embedder.embed).toHaveBeenLastCalledWith('new');
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(1);
    const hexAfter = (
      db
        .prepare('SELECT substr(hex(embedding), 1, 8) AS h FROM knowledge_vec')
        .get() as { h: string }
    ).h;
    expect(hexAfter).not.toBe(hexBefore);
  });

  it('update without content patch (kind only) → embedder NOT called', async () => {
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    embedder.embed.mockClear();
    await service.update('one', {
      project: PROJECT_PATH,
      kind: 'fundamental',
    });
    expect(embedder.embed).not.toHaveBeenCalled();
  });

  it('remove → vec row gone (trigger fires)', async () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
    });
    expect(
      (
        db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
          c: number;
        }
      ).c,
    ).toBe(1);
    service.remove(PROJECT_PATH, 'one');
    expect(
      (
        db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
          c: number;
        }
      ).c,
    ).toBe(0);
  });

  it('embedder url_missing → swallowed (no throw)', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    await expect(
      service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: 'one',
        content: 'x',
      }),
    ).resolves.toMatchObject({ slug: 'one' });
    expect(
      (
        db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
          c: number;
        }
      ).c,
    ).toBe(0);
  });
});
