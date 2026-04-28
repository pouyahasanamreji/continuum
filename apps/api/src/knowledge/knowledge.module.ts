import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { RelationalProjectPersistenceModule } from '../project/infrastructure/persistence/relational/relational-persistence.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTool } from './knowledge.tool';
import { KnowledgeController } from './knowledge.controller';
import { RelationalKnowledgePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { TokenizerModule } from '../tokenizer/tokenizer.module';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    RelationalProjectPersistenceModule,
    RelationalKnowledgePersistenceModule,
    McpModule.forFeature([KnowledgeTool], 'continuum'),
    TokenizerModule,
  ],
  controllers: restEnabled ? [KnowledgeController] : [],
  providers: [KnowledgeService, KnowledgeTool],
  exports: [KnowledgeService, RelationalKnowledgePersistenceModule],
})
export class KnowledgeModule {}
