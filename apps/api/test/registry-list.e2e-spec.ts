import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'registry-list-'));
process.env.ORCHESTRATOR_DB_PATH = join(tmpDir, 'orchestrator.db');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { McpRegistryDiscoveryService } from '@rekog/mcp-nest';
import { AppModule } from '../src/app.module';

interface ToolEnvelopeText {
  type: 'text';
  text: string;
}
interface ToolEnvelope {
  content: ToolEnvelopeText[];
  isError?: boolean;
}
interface RegistryListResponse {
  data: Array<Record<string, unknown>>;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

describe('registry_list MCP tool (e2e)', () => {
  let app: INestApplication;
  let discovery: McpRegistryDiscoveryService;
  let moduleId: string;
  const projectPath = '/tmp/registry-list-e2e-proj';

  async function callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolEnvelope> {
    const found = discovery.findTool(moduleId, name);
    if (!found) throw new Error(`tool ${name} not registered`);
    const instance = app.get(found.providerClass) as Record<
      string,
      (a: unknown) => ToolEnvelope | Promise<ToolEnvelope>
    >;
    return await instance[found.methodName](args);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    discovery = app.get(McpRegistryDiscoveryService);
    const ids = discovery.getMcpModuleIds();
    moduleId = ids[0];

    await callTool('project_create', { path: projectPath, name: 'p' });
    for (const slug of ['alpha', 'beta', 'gamma']) {
      await callTool('agent_create', {
        project: projectPath,
        slug,
        branch: `feat/${slug}`,
        worktree: `/tmp/wt-${slug}`,
        reservedPaths: [`reserved/${slug}/**`],
        request: `req ${slug}`,
        plan: `plan ${slug}`,
        implPrompt: `impl ${slug}`,
        coordinationBrief: `brief ${slug}`,
      });
    }
    // promote beta to active
    await callTool('agent_update', {
      project: projectPath,
      slug: 'beta',
      status: 'active',
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns paginated metadata envelope, no artifact bodies', async () => {
    const env = await callTool('registry_list', { project: projectPath });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as RegistryListResponse;
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
    expect(parsed.hasNextPage).toBe(false);
    expect(parsed.data.length).toBe(3);
    for (const row of parsed.data) {
      expect(row).toHaveProperty('slug');
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('branch');
      expect(row).toHaveProperty('worktree');
      expect(row).toHaveProperty('reservedPaths');
      expect(row).toHaveProperty('createdAt');
      expect(row).toHaveProperty('updatedAt');
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('projectId');
      expect(row).not.toHaveProperty('request');
      expect(row).not.toHaveProperty('plan');
      expect(row).not.toHaveProperty('implPrompt');
      expect(row).not.toHaveProperty('coordinationBrief');
      expect(row).not.toHaveProperty('postMergeNotes');
    }
  });

  it('filters by status', async () => {
    const env = await callTool('registry_list', {
      project: projectPath,
      status: 'active',
    });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as RegistryListResponse;
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].slug).toBe('beta');
    expect(parsed.data[0].status).toBe('active');
  });

  it('paginates with limit and signals hasNextPage', async () => {
    const first = (await callTool('registry_list', {
      project: projectPath,
      limit: 2,
      page: 1,
    })) as ToolEnvelope;
    const parsedFirst = JSON.parse(
      first.content[0].text,
    ) as RegistryListResponse;
    expect(parsedFirst.data.length).toBe(2);
    expect(parsedFirst.page).toBe(1);
    expect(parsedFirst.limit).toBe(2);
    expect(parsedFirst.hasNextPage).toBe(true);

    const second = await callTool('registry_list', {
      project: projectPath,
      limit: 2,
      page: 2,
    });
    const parsedSecond = JSON.parse(
      second.content[0].text,
    ) as RegistryListResponse;
    expect(parsedSecond.data.length).toBe(1);
    expect(parsedSecond.page).toBe(2);
    expect(parsedSecond.hasNextPage).toBe(false);
  });

  it('agent_get returns the full record with artifact bodies', async () => {
    const env = await callTool('agent_get', {
      project: projectPath,
      slug: 'alpha',
    });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as Record<string, unknown>;
    expect(parsed.slug).toBe('alpha');
    expect(parsed.request).toBe('req alpha');
    expect(parsed.plan).toBe('plan alpha');
    expect(parsed.implPrompt).toBe('impl alpha');
    expect(parsed.coordinationBrief).toBe('brief alpha');
  });
});
