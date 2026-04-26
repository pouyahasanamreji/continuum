import Database from 'better-sqlite3';
import { ProjectService, ProjectServiceError } from './project.service';
import { OrchestratorDbService } from './db.service';
import { PlotService } from './plot.service';
import { migrate } from './schema';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

function makeService(): {
  service: ProjectService;
  db: Database.Database;
  agents: () => number;
} {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const plot = {
    defaultTemplate: () => '# default plot template',
  } as unknown as PlotService;

  const service = new ProjectService(dbs, plot);

  return {
    service,
    db,
    agents: () =>
      (db.prepare('SELECT COUNT(*) AS c FROM agents').get() as { c: number }).c,
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
    const decomposed = '/Users/café';
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
    const { service, db } = makeService();
    const created = service.create({ path: '/Users/foo/proj' });
    expect(created.path).toBe('/Users/foo/proj');
    expect(created.name).toBe('proj');

    const plotRow = db
      .prepare('SELECT content FROM plots WHERE project_path = ?')
      .get('/Users/foo/proj') as { content: string };
    expect(plotRow.content).toBe('# default plot template');

    const kRow = db
      .prepare('SELECT content FROM knowledge WHERE project_path = ?')
      .get('/Users/foo/proj') as { content: string };
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

describe('ProjectService.delete', () => {
  it('cascades plot/plot_history/knowledge/knowledge_history/agents', () => {
    const { service, db, agents } = makeService();
    const path = '/Users/foo/proj';
    service.create({ path });

    const now = Date.now();
    db.prepare(
      'INSERT INTO plot_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
    ).run(path, 'old', 'diff', now);
    db.prepare(
      'INSERT INTO knowledge_history (project_path, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
    ).run(path, 'old', 'diff', now);
    db.prepare(
      `INSERT INTO agents (
        project_path, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, '[]', ?, ?, ?, ?, '', ?, ?)`,
    ).run(path, 'a1', 'feat/a1', '/tmp/wt', '', '', '', '', now, now);
    db.prepare(
      `INSERT INTO agents (
        project_path, slug, status, branch, worktree, reserved_paths_json,
        request, plan, impl_prompt, coordination_brief, post_merge_notes,
        created_at, updated_at
      ) VALUES (?, ?, 'draft', ?, ?, '[]', ?, ?, ?, ?, '', ?, ?)`,
    ).run(path, 'a2', 'feat/a2', '/tmp/wt', '', '', '', '', now, now);

    expect(agents()).toBe(2);

    const result = service.delete(path);
    expect(result.deleted).toBe(true);
    expect(result.cascadedAgents).toBe(2);

    expect(
      (
        db
          .prepare('SELECT COUNT(*) AS c FROM plots WHERE project_path = ?')
          .get(path) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM plot_history WHERE project_path = ?',
          )
          .get(path) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare('SELECT COUNT(*) AS c FROM knowledge WHERE project_path = ?')
          .get(path) as { c: number }
      ).c,
    ).toBe(0);
    expect(
      (
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM knowledge_history WHERE project_path = ?',
          )
          .get(path) as { c: number }
      ).c,
    ).toBe(0);
    expect(agents()).toBe(0);
  });
});

describe('ProjectService.rename', () => {
  it('updates name, leaves path stable', () => {
    const { service } = makeService();
    const path = '/Users/foo/proj';
    service.create({ path, name: 'orig' });
    const out = service.rename(path, 'renamed');
    expect(out.path).toBe(path);
    expect(out.name).toBe('renamed');
  });

  it('rejects newlines in name', () => {
    const { service } = makeService();
    service.create({ path: '/x/y' });
    expect(() => service.rename('/x/y', 'bad\nname')).toThrow(
      ProjectServiceError,
    );
  });

  it('rejects rename of nonexistent project', () => {
    const { service } = makeService();
    expect(() => service.rename('/nope', 'x')).toThrow(ProjectServiceError);
  });
});

describe('ProjectService.assertExists', () => {
  it('throws project_not_found when missing', () => {
    const { service } = makeService();
    expect(() => service.assertExists('/nope')).toThrow(ProjectServiceError);
    try {
      service.assertExists('/nope');
    } catch (e) {
      expect((e as ProjectServiceError).reason).toBe('project_not_found');
    }
  });

  it('passes when present', () => {
    const { service } = makeService();
    service.create({ path: '/x/y' });
    expect(() => service.assertExists('/x/y')).not.toThrow();
  });
});

describe('migrate idempotency', () => {
  it('two migrate calls on fresh DB then a third leaves user_version=2 with empty tables', () => {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    migrate(db);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    for (const t of [
      'projects',
      'plots',
      'plot_history',
      'knowledge',
      'knowledge_history',
      'agents',
    ]) {
      expect(
        (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c,
      ).toBe(0);
    }
  });
});
