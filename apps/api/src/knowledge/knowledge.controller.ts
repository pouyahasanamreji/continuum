import {
  Body,
  Controller,
  Delete,
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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { Knowledge } from './domain/knowledge';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
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

@ApiTags('Knowledge')
@Controller('api/orchestrator')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('knowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(Knowledge) })
  listKnowledge(
    @Query() query: QueryKnowledgeDto,
  ): InfinityPaginationResponseDto<Knowledge> {
    if (!query.project) missingProject();
    try {
      const page = query?.page ?? 1;
      const limit = Math.min(query?.limit ?? 10, 50);
      return infinityPagination(
        this.knowledge.findManyWithPagination({ ...query, page, limit }),
        { page, limit },
      );
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('knowledge/search')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiQuery({ name: 'q', type: String, required: true })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiOkResponse({ type: Knowledge, isArray: true })
  searchKnowledge(
    @Query('project') project?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Knowledge[] {
    if (!project) missingProject();
    if (!q) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { q: 'missingQuery' },
      });
    }
    const parsed = limit !== undefined ? Number(limit) : undefined;
    try {
      return this.knowledge.search(project, q, parsed);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Get('knowledge/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiOkResponse({ type: Knowledge })
  getKnowledge(
    @Param('slug') slug: string,
    @Query('project') project?: string,
  ): Knowledge {
    if (!project) missingProject();
    try {
      const found = this.knowledge.get(project, slug);
      if (!found) {
        throw new NotFoundException({
          status: 404,
          errors: { knowledge: 'knowledgeNotFound' },
        });
      }
      return found;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }

  @Post('knowledge')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: Knowledge })
  createKnowledge(@Body() body: CreateKnowledgeDto): Knowledge {
    try {
      return this.knowledge.create(body);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Patch('knowledge/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiOkResponse({ type: Knowledge })
  updateKnowledge(
    @Param('slug') slug: string,
    @Body() body: UpdateKnowledgeDto,
  ): Knowledge {
    if (!body.project) missingProject();
    try {
      return this.knowledge.update(slug, body);
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Delete('knowledge/:slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiNoContentResponse()
  deleteKnowledge(
    @Param('slug') slug: string,
    @Query('project') project?: string,
  ): void {
    if (!project) missingProject();
    try {
      this.knowledge.remove(project, slug);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
