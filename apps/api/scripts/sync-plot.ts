import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = __dirname;
const DEFAULT_CANONICAL = resolve(SCRIPT_DIR, '..', '..', '..', '..', 'PLOT.md');
const TARGET = resolve(SCRIPT_DIR, '..', 'src', 'orchestrator', 'assets', 'PLOT.md');

const canonical = process.env.ORCHESTRATOR_PLOT_PATH
  ? resolve(process.env.ORCHESTRATOR_PLOT_PATH)
  : DEFAULT_CANONICAL;

if (!existsSync(canonical)) {
  console.error(`sync-plot: canonical PLOT.md not found at ${canonical}`);
  process.exit(1);
}

const checkMode = process.argv.includes('--check');
const source = readFileSync(canonical, 'utf8');

if (checkMode) {
  if (!existsSync(TARGET)) {
    console.error(`sync-plot --check: target missing at ${TARGET}`);
    process.exit(1);
  }
  const target = readFileSync(TARGET, 'utf8');
  if (source !== target) {
    console.error(`sync-plot --check: ${TARGET} differs from ${canonical}`);
    process.exit(1);
  }
  console.log(`sync-plot --check: OK (${TARGET} matches ${canonical})`);
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, source);
console.log(`sync-plot: copied ${canonical} -> ${TARGET}`);
