import Database from 'better-sqlite3';
import { ProjectService } from './project.service';
import { ProjectServiceError } from '../common/errors/service-errors';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { PlotService } from '../plot/plot.service';
import { migrate } from '../database/schema';
import { ProjectRelationalRepository } from './infrastructure/persistence/relational/repositories/project.repository';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

function makeService(): {
  service: ProjectService;
  db: Database.Database;
  agents: () => number;
  idOf: (path: string) => number;
} {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const plot = {
    defaultTemplate: () => '# default plot template',
  } as unknown as PlotService;

  const repo = new ProjectRelationalRepository(dbs);
  const service = new ProjectService(repo, plot);

  return {
    service,
    db,
    agents: () =>
      (db.prepare('SELECT COUNT(*) AS c FROM agents').get() as { c: number }).c,
    idOf: (path: string) =>
      (
        db
          .prepare('SELECT id FROM projects WHERE path = ?')
          .get(path) as { id: number }
      ).id,
  };
}

describe('ProjectService.canonicalize', () => {
  let service: ProjectService;
  beforeEach(() => {
    service = makeService().service;
  });

  it('strips trailing slash', () => {
    expect(service.canonicalize('/Users/foo/')).toBe('/Users/foo');
  });

  it('collapses multiple slashes', () => {
    expect(service.canonicalize('/Users//foo///bar')).toBe('/Users/foo/bar');
  });

  it('rejects relative path', () => {
    expect(() => service.canonicalize('Users/foo')).toThrow(
      ProjectServiceError,
    );
  });

  it('rejects empty', () => {
    expect(() => service.canonicalize('')).toThrow(ProjectServiceError);
  });

  it('rejects tilde-expansion', () => {
    expect(() => service.canonicalize('~/Users/foo')).toThrow(
      ProjectServiceError,
    );
  });

  it('rejects backslashes', () => {
    expect(() => service.canonicalize('/Users\\foo')).toThrow(
      ProjectServiceError,
    );
  });

  it('accepts /Users/foo', () => {
    expect(service.canonicalize('/Users/foo')).toBe('/Users/foo');
  });

  it('NFC-normalises', () => {
    const decomposed = '/Users/café';
    expect(service.canonicalize(decomposed)).toBe('/Users/café');
  });

  it('rejects path > 1024 chars', () => {
    const long = '/' + 'a'.repeat(1025);
    expect(() => service.canonicalize(long)).toThrow(ProjectServiceError);
  });

  it('rejects relative segments', () => {
    expect(() => service.canonicalize('/Users/foo/../bar')).toThrow(
      ProjectServiceError,
    );
    expect(() => service.canonicalize('/Users/./foo')).toThrow(
      ProjectServiceError,
    );
  });

  it('rejects root /', () => {
    expect(() => service.canonicalize('/')).toThrow(ProjectServiceError);
  });
});

describe('ProjectService.create', () => {
  it('inserts project + plot (default template) + empty knowledge', () => {
    const { service, db, idOf } = makeService();
    const created = service.create({ path: '/Users/foo/proj' });
    expect(created.path).toBe('/Users/foo/proj');
    expect(created.name).toBe('proj');

    const id = idOf('/Users/foo/proj');
    const plotRow = db
      .prepare('SELECT content FROM plots WHERE project_id = ?')
      .get(id) as { content: string };
    expect(plotRow.content).toBe('# default plot template');

    const kRow = db
      .prepare('SELECT content FROM knowledge WHERE project_id = ?')
      .get(id) as { content: string };
    expect(kRow.content).toBe('');
  });

  it('throws project_exists on duplicate', () => {
    const { service } = makeService();
    service.create({ path: '/Users/foo/proj' });
    expect(() => service.create({ path: '/Users/foo/proj' })).toThrow(
      ProjectServiceError,
    );
    try {
      service.create({ path: '/Users/foo/proj' });
    } catch (e) {
      expect((e as ProjectServiceError).reason).toBe('project_exists');
    }
  });

  it('derives name from basename when name omitted', () => {
    const { service } = makeService();
    expect(service.create({ path: '/a/b/cpass' }).name).toBe('cpass');
  });

  it('uses provided name', () => {
    const { service } = makeService();
    expect(
      service.create({ path: '/a/b/cpass', name: 'My Project' }).name,
    ).toBe('My Project');
  });
});

describe('ProjectService.remove', () => {
  it('cascades plot/plot_history/knowledge/knowledge_history/agents', () => {
    const { service, db, agents, idOf } = makeService();
    const path = '/Users/foo/proj';
    service.create({ path });
    const id = idOf(path);

    const now = Date.now();
    db.prepare(
      'INSERT INTO plot_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, 'old', 'diff', now);
    db.prepare(
      'INSERT INTO knowledge_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, 'old', 'diff', now);
    db.prepare(
      `INSERT INTO agents (
        project_id, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, '[]', ?, ?, ?, ?, '', ?, ?)`,
    ).run(id, 'a1', 'feat/a1', '/tmp/wt', '', '', '', '', now, now);
    db.prepare(
      `INSERT INTO agents (
        project_id, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, '[]', ?, ?, ?, ?, '', ?, ?)`,
    ).run(id, 'a2', 'feat/a2', '/tmp/wt', '', '', '', '', now, now);

    expect(agents()).toBe(2);

    const result = service.remove(path);
    expect(result.deleted).toBe(true);
    expect(result.cascadedAgents).toBe(2);

    expect(
      (
        db
          .prepare('SELECT COUNT(*) AS c FROM plots WHERE project_id = ?')
          .get(id) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM plot_history WHERE project_id = ?',
          )
          .get(id) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare('SELECT COUNT(*) AS c FROM knowledge WHERE project_id = ?')
          .get(id) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM knowledge_history WHERE project_id = ?',
          )
          .get(id) as { c: number }
      ).c,
    ).toBe(0);
    expect(agents()).toBe(0);
  });
});

describe('ProjectService.update', () => {
  it('updates name, leaves path stable', () => {
    const { service } = makeService();
    const path = '/Users/foo/proj';
    service.create({ path, name: 'orig' });
    const out = service.update(path, { name: 'renamed' });
    expect(out.path).toBe(path);
    expect(out.name).toBe('renamed');
  });

  it('rejects newlines in name', () => {
    const { service } = makeService();
    service.create({ path: '/x/y' });
    expect(() => service.update('/x/y', { name: 'bad\nname' })).toThrow(
      ProjectServiceError,
    );
  });

  it('rejects update of nonexistent project', () => {
    const { service } = makeService();
    expect(() => service.update('/nope', { name: 'x' })).toThrow(
      ProjectServiceError,
    );
  });

  it('throws no_change on empty patch (decision 4)', () => {
    const { service } = makeService();
    service.create({ path: '/x/y' });
    expect(() => service.update('/x/y', {})).toThrow(ProjectServiceError);
    try {
      service.update('/x/y', {});
    } catch (e) {
      expect((e as ProjectServiceError).reason).toBe('no_change');
    }
  });
});
