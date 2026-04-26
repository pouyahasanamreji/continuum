import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
} from '@nestjs/common';
import { PlotService, PlotServiceError } from './plot.service';
import { KnowledgeService, KnowledgeUpdateError } from './knowledge.service';
import { AgentService, AgentServiceError } from './agent.service';
import { ProjectService, ProjectServiceError } from './project.service';
import { MigrationService } from './migration.service';
import type { MigrationInput } from './migration.service';

const decodePath = (encoded: string): string =>
  Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8',
  );

function requireProject(project: string | undefined): string {
  if (!project) {
    throw new BadRequestException({ reason: 'missing_project_query' });
  }
  return project;
}

function mapServiceError(err: unknown): never {
  if (err instanceof ProjectServiceError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    if (err.reason === 'project_exists') {
      throw new ConflictException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof KnowledgeUpdateError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof PlotServiceError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof AgentServiceError) {
    if (err.reason === 'project_not_found' || err.reason === 'not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    if (err.reason === 'slug_conflict') {
      throw new ConflictException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  throw err;
}

@Controller('api/orchestrator')
export class OrchestratorController {
  constructor(
    private readonly plot: PlotService,
    private readonly knowledge: KnowledgeService,
    private readonly agents: AgentService,
    private readonly projects: ProjectService,
    private readonly migration: MigrationService,
  ) {}

  @Get('projects')
  listProjects() {
    return this.projects.list();
  }

  @Get('projects/:encodedPath')
  getProject(@Param('encodedPath') encodedPath: string) {
    try {
      const path = decodePath(encodedPath);
      const found = this.projects.get(path);
      if (!found) {
        throw new NotFoundException({
          reason: 'project_not_found',
          detail: path,
        });
      }
      return found;
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Post('projects')
  @HttpCode(201)
  createProject(@Body() body: { path?: string; name?: string }) {
    if (!body || typeof body.path !== 'string') {
      throw new BadRequestException({
        reason: 'invalid_path',
        detail: 'missing path',
      });
    }
    try {
      return this.projects.create({ path: body.path, name: body.name });
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Post('projects/migrate')
  @HttpCode(200)
  migrateProject(@Body() body: MigrationInput) {
    if (!body || typeof body.path !== 'string') {
      throw new BadRequestException({
        reason: 'invalid_path',
        detail: 'missing path',
      });
    }
    if (body.agents !== undefined && !Array.isArray(body.agents)) {
      throw new BadRequestException({
        reason: 'invalid_agents',
        detail: 'agents must be an array',
      });
    }
    if (body.agents && body.agents.length > 200) {
      throw new PayloadTooLargeException({
        reason: 'too_many_agents',
        detail: '>200 agents',
      });
    }
    try {
      return this.migration.migrate(body);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Patch('projects/:encodedPath')
  renameProject(
    @Param('encodedPath') encodedPath: string,
    @Body() body: { name?: string },
  ) {
    if (!body || typeof body.name !== 'string') {
      throw new BadRequestException({
        reason: 'invalid_name',
        detail: 'missing name',
      });
    }
    try {
      const path = decodePath(encodedPath);
      return this.projects.rename(path, body.name);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Delete('projects/:encodedPath')
  deleteProject(@Param('encodedPath') encodedPath: string) {
    try {
      const path = decodePath(encodedPath);
      return this.projects.delete(path);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('plot')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getPlot(@Query('project') project?: string): string {
    const p = requireProject(project);
    try {
      return this.plot.getForProject(p).content;
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('knowledge')
  getKnowledge(
    @Query('project') project?: string,
    @Query('section') section?: string,
  ) {
    const p = requireProject(project);
    try {
      if (section) {
        const text = this.knowledge.getSection(p, section);
        if (text === null)
          throw new NotFoundException(`Section "${section}" not found`);
        return { content: text, section };
      }
      const all = this.knowledge.getAll(p);
      if (!all) throw new NotFoundException('Knowledge document is empty');
      return all;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }

  @Get('agents')
  listAgents(@Query('project') project?: string) {
    const p = requireProject(project);
    try {
      return this.agents.list(p);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('agents/:slug')
  getAgent(@Param('slug') slug: string, @Query('project') project?: string) {
    const p = requireProject(project);
    try {
      const found = this.agents.get(p, slug);
      if (!found) throw new NotFoundException(`Agent "${slug}" not found`);
      return found;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }
}
