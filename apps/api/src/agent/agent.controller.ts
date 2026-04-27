import {
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
  UnprocessableEntityException,
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

function missingProject(): never {
  throw new UnprocessableEntityException({
    status: 422,
    errors: { project: 'missingProjectQuery' },
  });
}

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
    if (!query.project) missingProject();
    try {
      const page = query?.page ?? 1;
      const limit = Math.min(query?.limit ?? 10, 50);
      return infinityPagination(
        this.agents.findManyWithPagination({ ...query, page, limit }),
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
    if (!project) missingProject();
    try {
      const found = this.agents.get(project, slug);
      if (!found) {
        throw new NotFoundException({
          status: 404,
          errors: { agent: 'agentNotFound' },
        });
      }
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
      return this.agents.create(body);
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
    if (!body.project) missingProject();
    try {
      return this.agents.update(slug, body);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
