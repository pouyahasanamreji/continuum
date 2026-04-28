import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { Knowledge } from './domain/knowledge';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { mapServiceError } from '../common/errors/map-service-error';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { TokenCountResponseDto } from '../tokenizer/dto/token-count-response.dto';
import { throwTokenizerError } from '../tokenizer/throw-tokenizer-error';

function missingProject(): never {
  throw new UnprocessableEntityException({
    status: 422,
    errors: { project: 'missingProjectQuery' },
  });
}

@ApiTags('Knowledge')
@Controller('api/orchestrator')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly tokenizer: TokenizerService,
  ) {}

  @Get('knowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: Knowledge })
  getKnowledge(@Query() query: QueryKnowledgeDto): Knowledge {
    if (!query.project) missingProject();
    try {
      const found = query.section
        ? this.knowledge.findBySection(query.project, query.section)
        : this.knowledge.findOne(query.project);
      if (!found) {
        throw new NotFoundException({
          status: 404,
          errors: query.section
            ? { section: 'sectionNotFound' }
            : { knowledge: 'knowledgeNotFound' },
        });
      }
      return found;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }

  @Get('knowledge/token-count')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenCountResponseDto })
  async getKnowledgeTokenCount(
    @Query() query: QueryKnowledgeDto,
  ): Promise<TokenCountResponseDto> {
    if (!query.project) missingProject();
    let knowledge;
    try {
      knowledge = this.knowledge.findOne(query.project);
    } catch (e) {
      mapServiceError(e);
    }
    if (!knowledge) {
      throw new NotFoundException({
        status: 404,
        errors: { knowledge: 'knowledgeNotFound' },
      });
    }
    try {
      return await this.tokenizer.countTokens(knowledge.content);
    } catch (e) {
      throwTokenizerError(e);
    }
  }
}
