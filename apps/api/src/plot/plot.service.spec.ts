// Cascade invariant: every project row is created via
// ProjectRelationalRepository.create, which atomically inserts the
// matching plots row in the same transaction. Tests construct
// projects through that path (never via raw INSERT INTO projects)
// so the plot row is real and PlotService.findOne returns a Plot.
import Database from 'better-sqlite3';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrchestratorDbService } from '../database/orchestrator-db.service';
import { migrate } from '../database/schema';
import { PlotService } from './plot.service';
import { PlotServiceError } from '../common/errors/service-errors';
import { ProjectRelationalRepository } from '../project/infrastructure/persistence/relational/repositories/project.repository';
import { PlotRelationalRepository } from './infrastructure/persistence/relational/repositories/plot.repository';

class StubDb {
  constructor(public readonly db: Database.Database) {}
}

function makeService(): {
  service: PlotService;
  db: Database.Database;
  projectRepo: ProjectRelationalRepository;
  createProject: (path: string, plotContent?: string) => number;
} {
  const tmp = mkdtempSync(join(tmpdir(), 'plot-svc-spec-'));
  const plotPath = join(tmp, 'PLOT.md');
  writeFileSync(plotPath, '# default plot template\n');
  process.env.ORCHESTRATOR_PLOT_PATH = plotPath;

  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const dbs = new StubDb(db) as unknown as OrchestratorDbService;
  const projectRepo = new ProjectRelationalRepository(dbs);
  const plotRepo = new PlotRelationalRepository(dbs);
  const service = new PlotService(plotRepo, projectRepo);
  service.onModuleInit();

  return {
    service,
    db,
    projectRepo,
    createProject: (path: string, plotContent = '# initial') => {
      const result = projectRepo.create({
        path,
        name: 'p',
        plotContent,
        knowledgeContent: '',
        now: Date.now(),
      });
      if (!result.ok) throw new Error('project create failed');
      return result.project.id;
    },
  };
}

const VALID_DIFF = `--- a/PLOT.md
+++ b/PLOT.md
@@ -1,1 +1,1 @@
-# initial
+# updated
`;

const HUNK_MISMATCH_DIFF = `--- a/PLOT.md
+++ b/PLOT.md
@@ -1,1 +1,1 @@
-# wrong-baseline
+# next
`;

describe('PlotService.findOne', () => {
  it('returns Plot after cascade create', () => {
    const { service, createProject } = makeService();
    createProject('/tmp/p1', '# initial');
    const found = service.findOne('/tmp/p1');
    expect(found).not.toBeNull();
    expect(found!.content).toBe('# initial');
    expect(found!.createdAt).toBeInstanceOf(Date);
    expect(found!.deletedAt).toBeNull();
  });

  it('throws PlotServiceError(project_not_found) for unknown project', () => {
    const { service } = makeService();
    expect(() => service.findOne('/tmp/missing')).toThrow(PlotServiceError);
    try {
      service.findOne('/tmp/missing');
    } catch (e) {
      expect((e as PlotServiceError).reason).toBe('project_not_found');
    }
  });

  it('returns null when project exists but plot row missing', () => {
    const { service, db, createProject } = makeService();
    createProject('/tmp/p2');
    db.prepare('DELETE FROM plots WHERE project_id = ?').run(
      (
        db.prepare('SELECT id FROM projects WHERE path = ?').get('/tmp/p2') as {
          id: number;
        }
      ).id,
    );
    expect(service.findOne('/tmp/p2')).toBeNull();
  });
});

describe('PlotService.update', () => {
  it('throws invalid_diff_headers when headers missing', () => {
    const { service, createProject } = makeService();
    createProject('/tmp/p3');
    expect(() =>
      service.update({ project: '/tmp/p3', diff: 'no headers here' }),
    ).toThrow(PlotServiceError);
    try {
      service.update({ project: '/tmp/p3', diff: 'no headers here' });
    } catch (e) {
      expect((e as PlotServiceError).reason).toBe('invalid_diff_headers');
    }
  });

  it('throws hunk_mismatch with detail when patch baseline mismatches', () => {
    const { service, createProject } = makeService();
    createProject('/tmp/p4', '# initial');
    try {
      service.update({ project: '/tmp/p4', diff: HUNK_MISMATCH_DIFF });
      fail('expected throw');
    } catch (e) {
      expect((e as PlotServiceError).reason).toBe('hunk_mismatch');
      expect((e as PlotServiceError).detail).toMatch(/^@@ /);
    }
  });

  it('happy path: returns updated Plot, advances content, appends history', () => {
    const { service, db, createProject } = makeService();
    createProject('/tmp/p5', '# initial\n');
    const result = service.update({ project: '/tmp/p5', diff: VALID_DIFF });
    expect(result.content).toBe('# updated\n');
    const projectId = (
      db.prepare('SELECT id FROM projects WHERE path = ?').get('/tmp/p5') as {
        id: number;
      }
    ).id;
    const histCount = (
      db
        .prepare('SELECT count(*) AS c FROM plot_history WHERE project_id = ?')
        .get(projectId) as { c: number }
    ).c;
    expect(histCount).toBe(1);
  });

  it('throws project_not_found for unknown project', () => {
    const { service } = makeService();
    expect(() =>
      service.update({ project: '/tmp/missing', diff: VALID_DIFF }),
    ).toThrow(PlotServiceError);
  });

  it('throws no_current_content when project has no plot row', () => {
    const { service, db, createProject } = makeService();
    createProject('/tmp/p6');
    db.prepare('DELETE FROM plots WHERE project_id = ?').run(
      (
        db.prepare('SELECT id FROM projects WHERE path = ?').get('/tmp/p6') as {
          id: number;
        }
      ).id,
    );
    try {
      service.update({ project: '/tmp/p6', diff: VALID_DIFF });
      fail('expected throw');
    } catch (e) {
      expect((e as PlotServiceError).reason).toBe('no_current_content');
    }
  });
});
