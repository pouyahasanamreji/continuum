import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { Knowledge } from './domain/knowledge';
import { mapServiceError } from '../common/errors/map-service-error';

@ApiTags('Knowledge')
@Controller('api/orchestrator')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('knowledge')
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiQuery({ name: 'section', type: String, required: false })
  @ApiOkResponse({ type: Knowledge })
  getKnowledge(
    @Query('project') project?: string,
    @Query('section') section?: string,
  ) {
    if (!project) {
      throw new BadRequestException({ reason: 'missing_project_query' });
    }
    try {
      if (section) {
        const text = this.knowledge.getSection(project, section);
        if (text === null)
          throw new NotFoundException(`Section "${section}" not found`);
        return { content: text, section };
      }
      const all = this.knowledge.getAll(project);
      if (!all) throw new NotFoundException('Knowledge document is empty');
      return all;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }
}
