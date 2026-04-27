import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { mapServiceError } from '../common/errors/map-service-error';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { createProjectDto } from './dto/create-project.dto';
import type { CreateProjectDto } from './dto/create-project.dto';
import { renameProjectDto } from './dto/rename-project.dto';

const decodePath = (encoded: string): string =>
  Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8',
  );

@Controller('api/orchestrator')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

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
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }

  @Post('projects')
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createProjectDto))
  createProject(@Body() body: CreateProjectDto) {
    try {
      return this.projects.create({ path: body.path, name: body.name });
    } catch (e) {
      mapServiceError(e);
    }
  }

  @Patch('projects/:encodedPath')
  @UsePipes(new ZodValidationPipe(renameProjectDto.pick({ name: true })))
  renameProject(
    @Param('encodedPath') encodedPath: string,
    @Body() body: { name: string },
  ) {
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
}
