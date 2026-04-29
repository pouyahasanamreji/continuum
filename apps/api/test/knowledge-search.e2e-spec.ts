import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'knowledge-search-'));
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

describe('knowledge_search MCP tool (e2e)', () => {
  let app: INestApplication;
  let discovery: McpRegistryDiscoveryService;
  let moduleId: string;
  const projectPath = '/tmp/knowledge-search-e2e-proj';

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
    await callTool('agent_create', {
      project: projectPath,
      slug: 'alpha',
      branch: 'feat/alpha',
      worktree: '/tmp/wt-alpha',
      reservedPaths: [],
      request: 'r',
      plan: 'p',
      implPrompt: 'i',
      coordinationBrief: 'c',
    });
    await callTool('knowledge_create', {
      project: projectPath,
      agentSlug: 'alpha',
      slug: 'cascade-pitfall',
      content: 'Cascade-on-delete fires only via project; agent_id never directly.',
    });
    await callTool('knowledge_create', {
      project: projectPath,
      agentSlug: 'alpha',
      slug: 'unrelated-thing',
      content: 'A note about caching.',
    });
    await callTool('knowledge_create', {
      project: projectPath,
      agentSlug: 'alpha',
      slug: 'binding-rule',
      content: 'Always do X before Y.',
      kind: 'fundamental',
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns matching lessons for a content keyword', async () => {
    const env = await callTool('knowledge_search', {
      project: projectPath,
      q: 'cascade',
    });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as Array<{ slug: string }>;
    expect(parsed.length).toBe(1);
    expect(parsed[0].slug).toBe('cascade-pitfall');
  });

  it('returns empty array when no rows match', async () => {
    const env = await callTool('knowledge_search', {
      project: projectPath,
      q: 'no-such-token-anywhere',
    });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as unknown[];
    expect(parsed).toEqual([]);
  });

  it('kind: fundamental filters to fundamental rows only', async () => {
    const env = await callTool('knowledge_search', {
      project: projectPath,
      kind: 'fundamental',
    });
    expect(env.isError).toBeFalsy();
    const parsed = JSON.parse(env.content[0].text) as Array<{
      slug: string;
      kind: string;
    }>;
    expect(parsed.length).toBe(1);
    expect(parsed[0].slug).toBe('binding-rule');
    expect(parsed[0].kind).toBe('fundamental');
  });

  it('returns isError when neither q nor kind provided', async () => {
    const env = await callTool('knowledge_search', { project: projectPath });
    expect(env.isError).toBe(true);
  });
});
