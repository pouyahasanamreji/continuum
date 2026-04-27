import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.ORCHESTRATOR_PLOT_PATH || !process.env.ORCHESTRATOR_DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), 'continuum-api-e2e-'));
  if (!process.env.ORCHESTRATOR_PLOT_PATH) {
    const plotPath = join(dir, 'PLOT.md');
    writeFileSync(plotPath, '# default plot template\n');
    process.env.ORCHESTRATOR_PLOT_PATH = plotPath;
  }
  if (!process.env.ORCHESTRATOR_DB_PATH) {
    process.env.ORCHESTRATOR_DB_PATH = join(dir, 'orchestrator.db');
  }
}
