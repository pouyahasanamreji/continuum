import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { mapServiceError } from '../common/errors/map-service-error';

@Controller('api/orchestrator')
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  @Get('agents')
  listAgents(@Query('project') project?: string) {
    if (!project) {
      throw new BadRequestException({ reason: 'missing_project_query' });
    }
    try {
      return this.agents.list(project);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('agents/:slug')
  getAgent(@Param('slug') slug: string, @Query('project') project?: string) {
    if (!project) {
      throw new BadRequestException({ reason: 'missing_project_query' });
    }
    try {
      const found = this.agents.get(project, slug);
      if (!found) throw new NotFoundException(`Agent "${slug}" not found`);
      return found;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }
}
