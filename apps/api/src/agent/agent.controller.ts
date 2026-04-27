import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { Agent } from './domain/agent';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { mapServiceError } from '../common/errors/map-service-error';

@ApiTags('Agents')
@Controller('api/orchestrator')
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  @Get('agents')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(Agent) })
  listAgents(
    @Query() query: QueryAgentDto,
  ): InfinityPaginationResponseDto<Agent> {
    if (!query.project) {
      throw new BadRequestException({ reason: 'missing_project_query' });
    }
    try {
      const page = query?.page ?? 1;
      const limit = Math.min(query?.limit ?? 10, 50);
      return infinityPagination(
        this.agents.findManyWithPagination(query.project, { page, limit }),
        { page, limit },
      );
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('agents/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiOkResponse({ type: Agent })
  getAgent(
    @Param('slug') slug: string,
    @Query('project') project?: string,
  ): Agent {
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

  @Post('agents')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: Agent })
  createAgent(@Body() body: CreateAgentDto): Agent {
    try {
      const { project, ...rest } = body;
      return this.agents.create(project, rest);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Patch('agents/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiOkResponse({ type: Agent })
  updateAgent(
    @Param('slug') slug: string,
    @Body() body: UpdateAgentDto,
  ): Agent {
    if (!body.project) {
      throw new BadRequestException({ reason: 'missing_project_body' });
    }
    try {
      const { project, ...patch } = body;
      return this.agents.update(project, slug, patch);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
