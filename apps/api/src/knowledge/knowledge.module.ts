import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { DatabaseModule } from '../database/database.module';
import { RelationalProjectPersistenceModule } from '../project/infrastructure/persistence/relational/relational-persistence.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTool } from './knowledge.tool';
import { KnowledgeController } from './knowledge.controller';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    DatabaseModule,
    RelationalProjectPersistenceModule,
    McpModule.forFeature([KnowledgeTool], 'continuum'),
  ],
  controllers: restEnabled ? [KnowledgeController] : [],
  providers: [KnowledgeService, KnowledgeTool],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
