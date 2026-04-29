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
import { AppSettingsService } from '../app-settings/app-settings.service';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

class StubAppSettings {
  constructor(public store: Map<string, string | null> = new Map()) {}
  resolve(key: string): string | null {
    const v = this.store.has(key) ? (this.store.get(key) ?? null) : null;
    if (v !== null && v !== '') return v;
    return process.env[key] ?? null;
  }
  readAllForPanel() {
    const dimRaw = this.resolve('EMBEDDER_DIM');
    const dim =
      dimRaw === null || dimRaw === '' ? null : Number.parseInt(dimRaw, 10);
    return {
      anthropicApiKey: null,
      anthropicTokenizerModel: null,
      embedderUrl: null,
      embedderModel: this.resolve('EMBEDDER_MODEL'),
      embedderDim: Number.isNaN(dim ?? NaN) ? null : dim,
      effective: {
        anthropicApiKey: 'unset' as const,
        anthropicTokenizerModel: 'default' as const,
        embedderUrl: 'unset' as const,
        embedderModel: 'default' as const,
        embedderDim: 'default' as const,
      },
    };
  }
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
  settings: StubAppSettings;
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
  const settings = new StubAppSettings();
  const service = new KnowledgeService(
    knowledgeRepo,
    projectRepo,
    agentRepo,
    embedder as unknown as EmbedderService,
    vecRepo,
    settings as unknown as AppSettingsService,
  );

  return {
    service,
    knowledgeRepo,
    vecRepo,
    projectRepo,
    agentRepo,
    embedder,
    settings,
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
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'unique-body',
    });
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    expect(await service.search(PROJECT_PATH, 'absent', undefined)).toEqual([]);
  });

  it('matches by content substring', async () => {
    const { service, seedAgent, embedder } = makeHarness();
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
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    const found = await service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('one');
  });

  it('matches by slug substring', async () => {
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'cascade-rule',
      content: 'body',
    });
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    const found = await service.search(PROJECT_PATH, 'cascade', undefined);
    expect(found.length).toBe(1);
  });

  it('respects limit', async () => {
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    for (let i = 0; i < 5; i++) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug: `s-${i}`,
        content: `match-${i}`,
      });
    }
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    const found = await service.search(PROJECT_PATH, 'match', undefined, 2);
    expect(found.length).toBe(2);
  });

  it('clamps limit to max 50', async () => {
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'match',
    });
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    expect(
      (await service.search(PROJECT_PATH, 'match', undefined, 9999)).length,
    ).toBe(1);
  });

  it('throws project_not_found for unknown project', async () => {
    const { service } = makeHarness();
    try {
      await service.search('/missing', 'x', undefined);
      fail('expected throw');
    } catch (e) {
      expect((e as KnowledgeServiceError).reason).toBe('project_not_found');
    }
  });
});

describe('KnowledgeService.search vector path', () => {
  it('q + embedder OK + vec rows populated → calls searchByVector, never searchByContent', async () => {
    const { service, seedAgent, embedder, knowledgeRepo } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'body',
    });
    const vecSpy = jest.spyOn(knowledgeRepo, 'searchByVector');
    const likeSpy = jest.spyOn(knowledgeRepo, 'searchByContent');
    embedder.embed.mockClear();
    embedder.embed.mockResolvedValueOnce(new Array(768).fill(0.1));
    const found = await service.search(PROJECT_PATH, 'anything', undefined);
    expect(embedder.embed).toHaveBeenCalledTimes(1);
    expect(vecSpy).toHaveBeenCalledTimes(1);
    expect(likeSpy).not.toHaveBeenCalled();
    expect(found.length).toBe(1);
  });

  it('q + EmbedderError(url_missing) → falls back to searchByContent + warns', async () => {
    const { service, seedAgent, embedder, knowledgeRepo } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'cascade body',
    });
    const vecSpy = jest.spyOn(knowledgeRepo, 'searchByVector');
    const likeSpy = jest.spyOn(knowledgeRepo, 'searchByContent');
    const warnSpy = jest
      .spyOn(
        (service as unknown as { logger: { warn: jest.Mock } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    const found = await service.search(PROJECT_PATH, 'cascade', undefined);
    expect(vecSpy).not.toHaveBeenCalled();
    expect(likeSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('url_missing'),
    );
    expect(found.length).toBe(1);
  });

  it('q + EmbedderError(upstream_failed) → falls back to searchByContent', async () => {
    const { service, seedAgent, embedder, knowledgeRepo } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'cascade body',
    });
    const vecSpy = jest.spyOn(knowledgeRepo, 'searchByVector');
    const likeSpy = jest.spyOn(knowledgeRepo, 'searchByContent');
    jest
      .spyOn(
        (service as unknown as { logger: { warn: jest.Mock } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    embedder.embed.mockRejectedValueOnce(
      new EmbedderError('upstream_failed', 'boom'),
    );
    const found = await service.search(PROJECT_PATH, 'cascade', undefined);
    expect(vecSpy).not.toHaveBeenCalled();
    expect(likeSpy).toHaveBeenCalledTimes(1);
    expect(found.length).toBe(1);
  });

  it('q + embedder OK + searchByVector throws → falls back + warns', async () => {
    const { service, seedAgent, embedder, knowledgeRepo } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'cascade body',
    });
    const vecSpy = jest
      .spyOn(knowledgeRepo, 'searchByVector')
      .mockImplementation(() => {
        throw new Error('vec0 boom');
      });
    const likeSpy = jest.spyOn(knowledgeRepo, 'searchByContent');
    const warnSpy = jest
      .spyOn(
        (service as unknown as { logger: { warn: jest.Mock } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    embedder.embed.mockResolvedValueOnce(new Array(768).fill(0.1));
    const found = await service.search(PROJECT_PATH, 'cascade', undefined);
    expect(vecSpy).toHaveBeenCalledTimes(1);
    expect(likeSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('vec0 boom'));
    expect(found.length).toBe(1);
  });

  it('kind only (no q) → embedder NOT called; searchByContent called with query=undefined', async () => {
    const { service, seedAgent, embedder, knowledgeRepo } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'x',
      kind: 'fundamental',
    });
    embedder.embed.mockClear();
    const vecSpy = jest.spyOn(knowledgeRepo, 'searchByVector');
    const likeSpy = jest.spyOn(knowledgeRepo, 'searchByContent');
    await service.search(PROJECT_PATH, undefined, 'fundamental');
    expect(embedder.embed).not.toHaveBeenCalled();
    expect(vecSpy).not.toHaveBeenCalled();
    expect(likeSpy).toHaveBeenCalledWith(
      expect.any(Number),
      undefined,
      'fundamental',
      expect.any(Number),
    );
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
    const found = await service.search(PROJECT_PATH, undefined, 'fundamental');
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('a');
  });

  it('search with q AND kind AND-combines', async () => {
    const { service, seedAgent, embedder } = makeHarness();
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
    embedder.embed.mockRejectedValueOnce(new EmbedderError('url_missing'));
    const found = await service.search(PROJECT_PATH, 'cascade', 'fundamental');
    expect(found.length).toBe(1);
    expect(found[0].slug).toBe('a');
  });

  it('search with neither q nor kind throws invalid_query', async () => {
    const { service } = makeHarness();
    try {
      await service.search(PROJECT_PATH, undefined, undefined);
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

describe('KnowledgeService.vectorizeAll', () => {
  it('mode=missing skips already-vectorized rows', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    for (const slug of ['a', 'b', 'c']) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug,
        content: `body-${slug}`,
      });
    }
    // Wipe two of three vec rows so missing-mode has work to do.
    db.prepare(
      `DELETE FROM knowledge_vec WHERE knowledge_id IN
       (SELECT id FROM knowledge WHERE slug IN ('b', 'c'))`,
    ).run();
    embedder.embed.mockClear();
    const result = await service.vectorizeAll({ mode: 'missing' });
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.skipped).toBe(0);
    expect(embedder.embed).toHaveBeenCalledTimes(2);
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(3);
  });

  it('mode=all without targetDim deletes existing vec rows and re-embeds all', async () => {
    const { service, seedAgent, embedder, db } = makeHarness();
    seedAgent('alpha');
    for (const slug of ['a', 'b']) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug,
        content: `body-${slug}`,
      });
    }
    embedder.embed.mockClear();
    const result = await service.vectorizeAll({ mode: 'all' });
    expect(result.processed).toBe(2);
    expect(embedder.embed).toHaveBeenCalledTimes(2);
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(2);
  });

  it('mode=all with targetDim=512 recreates table at 512 and trigger still fires', async () => {
    const { service, seedAgent, vecRepo, embedder, db } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'one',
      content: 'body',
    });
    embedder.embed.mockResolvedValue(new Array(512).fill(0.5));
    const result = await service.vectorizeAll({
      mode: 'all',
      targetDim: 512,
    });
    expect(result.processed).toBe(1);
    expect(vecRepo.currentDim()).toBe(512);
    const sql = (
      db
        .prepare(
          `SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_vec'`,
        )
        .get() as { sql: string }
    ).sql;
    expect(sql).toMatch(/FLOAT\[512\]/);
    // Trigger fires: deleting the knowledge row removes the vec row.
    service.remove(PROJECT_PATH, 'one');
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM knowledge_vec').get() as {
        c: number;
      }
    ).c;
    expect(c).toBe(0);
  });

  it('continues past embedder errors', async () => {
    const { service, seedAgent, embedder } = makeHarness();
    seedAgent('alpha');
    for (const slug of ['a', 'b', 'c']) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug,
        content: `body-${slug}`,
      });
    }
    embedder.embed.mockReset();
    embedder.embed
      .mockResolvedValueOnce(new Array(768).fill(0.1))
      .mockRejectedValueOnce(new EmbedderError('upstream_failed', 'boom'))
      .mockResolvedValueOnce(new Array(768).fill(0.1));
    const result = await service.vectorizeAll({ mode: 'all' });
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(1);
  });
});

describe('KnowledgeService.getVectorizeStatus', () => {
  it('reports correct totals/missing/currentDim', async () => {
    const { service, seedAgent, db } = makeHarness();
    seedAgent('alpha');
    for (const slug of ['a', 'b']) {
      await service.create({
        project: PROJECT_PATH,
        agentSlug: 'alpha',
        slug,
        content: `body-${slug}`,
      });
    }
    db.prepare(
      `DELETE FROM knowledge_vec WHERE knowledge_id IN
       (SELECT id FROM knowledge WHERE slug = 'b')`,
    ).run();
    const status = service.getVectorizeStatus();
    expect(status.totalKnowledge).toBe(2);
    expect(status.totalVectors).toBe(1);
    expect(status.missing).toBe(1);
    expect(status.currentDim).toBe(768);
    expect(status.stale).toBe(0);
  });

  it('reports stale=totalVectors when EMBEDDER_DIM differs from currentDim', async () => {
    const { service, seedAgent, settings } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'body',
    });
    settings.store.set('EMBEDDER_DIM', '512');
    const status = service.getVectorizeStatus();
    expect(status.currentDim).toBe(768);
    expect(status.totalVectors).toBe(1);
    expect(status.stale).toBe(1);
  });

  it('reports stale=0 when EMBEDDER_DIM matches currentDim', async () => {
    const { service, seedAgent, settings } = makeHarness();
    seedAgent('alpha');
    await service.create({
      project: PROJECT_PATH,
      agentSlug: 'alpha',
      slug: 'a',
      content: 'body',
    });
    settings.store.set('EMBEDDER_DIM', '768');
    const status = service.getVectorizeStatus();
    expect(status.stale).toBe(0);
  });
});
