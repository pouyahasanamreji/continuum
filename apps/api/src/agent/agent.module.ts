import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { DatabaseModule } from '../database/database.module';
import { RelationalProjectPersistenceModule } from '../project/infrastructure/persistence/relational/relational-persistence.module';
import { AgentService } from './agent.service';
import { AgentTool } from './agent.tool';
import { AgentController } from './agent.controller';
import { RelationalAgentPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    DatabaseModule,
    RelationalProjectPersistenceModule,
    RelationalAgentPersistenceModule,
    McpModule.forFeature([AgentTool], 'continuum'),
  ],
  controllers: restEnabled ? [AgentController] : [],
  providers: [AgentService, AgentTool],
  exports: [AgentService, RelationalAgentPersistenceModule],
})
export class AgentModule {}
