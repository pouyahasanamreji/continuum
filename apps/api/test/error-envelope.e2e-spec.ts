import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'error-envelope-'));
const plotPath = join(tmpDir, 'PLOT.md');
writeFileSync(plotPath, '# default plot template\n');
process.env.ORCHESTRATOR_PLOT_PATH = plotPath;
process.env.ORCHESTRATOR_DB_PATH = join(tmpDir, 'orchestrator.db');
process.env.PANEL_REST_ENABLED = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const encodePath = (p: string): string =>
  Buffer.from(p, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

describe('Error envelope (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors: ValidationError[]) => {
          const errs: Record<string, string> = {};
          for (const e of errors) {
            const constraints = Object.keys(e.constraints ?? {});
            errs[e.property] = constraints[0] ?? 'invalid';
          }
          return new UnprocessableEntityException({
            status: 422,
            errors: errs,
          });
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns 404 envelope for missing project on GET /projects/:encodedPath', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/orchestrator/projects/${encodePath('/Users/missing/proj')}`)
      .expect(404);
    expect(res.body.errors).toEqual({ project: 'projectNotFound' });
  });

  it('returns 422 envelope when class-validator fails (POST /projects without path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orchestrator/projects')
      .send({})
      .expect(422);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.path).toBeDefined();
  });

  it('returns 409 envelope on duplicate project create', async () => {
    await request(app.getHttpServer())
      .post('/api/orchestrator/projects')
      .send({ path: '/tmp/dup-proj' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/orchestrator/projects')
      .send({ path: '/tmp/dup-proj' })
      .expect(409);
    expect(res.body.errors).toEqual({ path: 'projectAlreadyExists' });
  });

  it('returns 422 envelope on invalid path canonicalisation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orchestrator/projects')
      .send({ path: 'notabsolute' })
      .expect(422);
    expect(res.body.errors).toEqual({ path: 'invalidPath' });
  });
});
