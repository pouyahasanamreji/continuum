import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'swagger-e2e-'));
process.env.ORCHESTRATOR_DB_PATH = join(tmpDir, 'orchestrator.db');
process.env.PANEL_REST_ENABLED = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

describe('Swagger document (e2e)', () => {
  let app: INestApplication;
  let document: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Continuum API')
        .setVersion('0.1.0')
        .build(),
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('emits OpenAPI 3.x with the expected schemas', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.components?.schemas).toBeDefined();
    const schemas = document.components!.schemas as Record<string, unknown>;
    expect(schemas.Project).toBeDefined();
    expect(schemas.CreateProjectDto).toBeDefined();
    expect(schemas.UpdateProjectDto).toBeDefined();
    expect(schemas.Agent).toBeDefined();
    expect(schemas.InfinityPaginationProjectResponseDto).toBeDefined();
  });

  it('Project schema marks createdAt as date-time', () => {
    const schemas = document.components!.schemas as Record<
      string,
      { properties?: Record<string, { format?: string; type?: string }> }
    >;
    const created = schemas.Project.properties?.createdAt;
    expect(created).toBeDefined();
    expect(created?.format).toBe('date-time');
  });
});
