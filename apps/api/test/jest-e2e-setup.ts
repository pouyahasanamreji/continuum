import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.ORCHESTRATOR_DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), 'continuum-api-e2e-'));
  process.env.ORCHESTRATOR_DB_PATH = join(dir, 'orchestrator.db');
}
