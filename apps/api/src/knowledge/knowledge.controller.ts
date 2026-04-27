import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { mapServiceError } from '../common/errors/map-service-error';

@Controller('api/orchestrator')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('knowledge')
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
