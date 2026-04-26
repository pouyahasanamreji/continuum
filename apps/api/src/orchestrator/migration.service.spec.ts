import Database from 'better-sqlite3';
import { OrchestratorDbService } from './db.service';
import { PlotService } from './plot.service';
import { ProjectService, ProjectServiceError } from './project.service';
import { MigrationService } from './migration.service';
import { migrate } from './schema';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

function makeService(): {
  service: MigrationService;
  projects: ProjectService;
  db: Database.Database;
} {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const plot = {
    defaultTemplate: () => '# default plot template',
  } as unknown as PlotService;
  const projects = new ProjectService(dbs, plot);
  const service = new MigrationService(dbs, projects, plot);

  return { service, projects, db };
}

const AGENT_DOC = `- **Status**: draft
- **Branch**: feat/alpha

## Human request (verbatim)

hi

## Final plan summary

plan

## Implementation prompt

prompt

## Coordination brief

brief

## Post-merge notes

notes
`;

describe('MigrationService', () => {
  it('creates project with all fields', () => {
    const { service, db } = makeService();
    const r = service.migrate({
      path: '/tmp/p',
      name: 'P',
      plotContent: '# p plot',
      knowledgeContent: '# p know',
      agents: [{ slug: 'alpha', content: AGENT_DOC }],
    });
    expect(r.created).toBe(true);
    expect(r.plotUpdated).toBe(true);
    expect(r.knowledgeUpdated).toBe(true);
    expect(r.agentsUpserted).toBe(1);
    expect(r.agentsSkipped).toBe(0);

    const proj = db
      .prepare('SELECT * FROM projects WHERE path = ?')
      .get('/tmp/p') as { name: string };
    expect(proj.name).toBe('P');

    const plot = db
      .prepare('SELECT content FROM plots WHERE project_path = ?')
      .get('/tmp/p') as { content: string };
    expect(plot.content).toBe('# p plot');
  });

  it('plot history grows on update of existing project', () => {
    const { service, db } = makeService();
    service.migrate({
      path: '/tmp/p',
      plotContent: 'v1',
      knowledgeContent: '',
    });
    const r = service.migrate({ path: '/tmp/p', plotContent: 'v2' });
    expect(r.created).toBe(false);
    expect(r.plotUpdated).toBe(true);

    const cnt = db
      .prepare('SELECT count(*) AS c FROM plot_history WHERE project_path = ?')
      .get('/tmp/p') as { c: number };
    expect(cnt.c).toBe(2);
  });

  it('idempotent: repeating identical input adds no history', () => {
    const { service, db } = makeService();
    const input = {
      path: '/tmp/p',
      plotContent: 'P',
      knowledgeContent: 'K',
      agents: [{ slug: 'alpha', content: AGENT_DOC }],
    };
    service.migrate(input);
    const before = db
      .prepare('SELECT count(*) AS c FROM plot_history')
      .get() as { c: number };
    const r = service.migrate(input);
    const after = db
      .prepare('SELECT count(*) AS c FROM plot_history')
      .get() as { c: number };
    expect(r.plotUpdated).toBe(false);
    expect(r.knowledgeUpdated).toBe(false);
    expect(after.c).toBe(before.c);
  });

  it('skips bad slug + records warning', () => {
    const { service } = makeService();
    const r = service.migrate({
      path: '/tmp/p',
      agents: [{ slug: 'BadSlug', content: AGENT_DOC }],
    });
    expect(r.agentsSkipped).toBe(1);
    expect(r.agentsUpserted).toBe(0);
    expect(r.warnings.some((w) => w.includes('invalid slug'))).toBe(true);
  });

  it('skips empty content agent + records warning', () => {
    const { service } = makeService();
    const r = service.migrate({
      path: '/tmp/p',
      agents: [{ slug: 'alpha', content: '   ' }],
    });
    expect(r.agentsSkipped).toBe(1);
    expect(r.warnings.some((w) => w.includes('empty content'))).toBe(true);
  });

  it('empty agents array does not delete existing agents', () => {
    const { service, db } = makeService();
    service.migrate({
      path: '/tmp/p',
      agents: [{ slug: 'alpha', content: AGENT_DOC }],
    });
    const r = service.migrate({ path: '/tmp/p', agents: [] });
    expect(r.agentsUpserted).toBe(0);
    const rows = db
      .prepare('SELECT slug FROM agents WHERE project_path = ?')
      .all('/tmp/p');
    expect(rows.length).toBe(1);
  });

  it('throws ProjectServiceError on invalid path', () => {
    const { service } = makeService();
    expect(() => service.migrate({ path: 'notabsolute' })).toThrow(
      ProjectServiceError,
    );
  });

  it('coerces unknown status to draft + warns', () => {
    const { service, db } = makeService();
    const r = service.migrate({
      path: '/tmp/p',
      agents: [
        {
          slug: 'alpha',
          content: '- **Status**: weird\n\n## Human request (verbatim)\nx\n',
        },
      ],
    });
    expect(r.agentsUpserted).toBe(1);
    expect(r.warnings.some((w) => w.includes('unrecognized status'))).toBe(
      true,
    );
    const row = db
      .prepare('SELECT status FROM agents WHERE project_path = ? AND slug = ?')
      .get('/tmp/p', 'alpha') as { status: string };
    expect(row.status).toBe('draft');
  });

  it('preserves created_at on agent re-upsert', () => {
    const { service, db } = makeService();
    service.migrate({
      path: '/tmp/p',
      agents: [{ slug: 'alpha', content: AGENT_DOC }],
    });
    const first = db
      .prepare('SELECT created_at FROM agents WHERE slug = ?')
      .get('alpha') as { created_at: number };

    // brief sleep is overkill — just call again
    service.migrate({
      path: '/tmp/p',
      agents: [{ slug: 'alpha', content: AGENT_DOC + '\n' }],
    });
    const second = db
      .prepare('SELECT created_at FROM agents WHERE slug = ?')
      .get('alpha') as { created_at: number };
    expect(second.created_at).toBe(first.created_at);
  });
});
