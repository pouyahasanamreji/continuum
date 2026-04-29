import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-discovery-'));
process.env.ORCHESTRATOR_DB_PATH = join(tmpDir, 'orchestrator.db');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { McpRegistryDiscoveryService } from '@rekog/mcp-nest';
import { AppModule } from '../src/app.module';

const EXPECTED_TOOLS = [
  'project_list',
  'project_get',
  'project_create',
  'project_rename',
  'project_delete',
  'plot',
  'plot_update',
  'knowledge_list',
  'knowledge_get',
  'knowledge_create',
  'knowledge_update',
  'knowledge_delete',
  'knowledge_search',
  'registry_list',
  'agent_get',
  'agent_create',
  'agent_update',
] as const;

describe('MCP discovery (e2e)', () => {
  let app: INestApplication;
  let discovery: McpRegistryDiscoveryService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    discovery = app.get(McpRegistryDiscoveryService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('registers exactly the expected 17 MCP tools', () => {
    const moduleIds = discovery.getMcpModuleIds();
    expect(moduleIds.length).toBe(1);
    const tools = discovery.getTools(moduleIds[0]);
    const names = tools.map((t) => t.metadata.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });
});
