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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { Project } from './domain/project';
import { mapServiceError } from '../common/errors/map-service-error';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

const decodePath = (encoded: string): string =>
  Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8',
  );

@ApiTags('Projects')
@Controller('api/orchestrator')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get('projects')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(Project) })
  listProjects(
    @Query() query: QueryProjectDto,
  ): InfinityPaginationResponseDto<Project> {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 10, 50);
    return infinityPagination(
      this.projects.findManyWithPagination({ page, limit }),
      { page, limit },
    );
  }

  @Get('projects/:encodedPath')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'encodedPath', type: String, required: true })
  @ApiOkResponse({ type: Project })
  getProject(@Param('encodedPath') encodedPath: string): Project {
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
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: Project })
  createProject(@Body() body: CreateProjectDto): Project {
    try {
      return this.projects.create({ path: body.path, name: body.name });
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Patch('projects/:encodedPath')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'encodedPath', type: String, required: true })
  @ApiOkResponse({ type: Project })
  updateProject(
    @Param('encodedPath') encodedPath: string,
    @Body() body: UpdateProjectDto,
  ): Project {
    try {
      const path = decodePath(encodedPath);
      return this.projects.update(path, { name: body.name });
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Delete('projects/:encodedPath')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'encodedPath', type: String, required: true })
  @ApiNoContentResponse()
  deleteProject(@Param('encodedPath') encodedPath: string) {
    try {
      const path = decodePath(encodedPath);
      return this.projects.delete(path);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
