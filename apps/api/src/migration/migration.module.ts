import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { DatabaseModule } from '../database/database.module';
import { ProjectModule } from '../project/project.module';
import { PlotModule } from '../plot/plot.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentModule } from '../agent/agent.module';
import { MigrationService } from './migration.service';
import { MigrationTool } from './migration.tool';
import { MigrationController } from './migration.controller';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    DatabaseModule,
    ProjectModule,
    PlotModule,
    KnowledgeModule,
    AgentModule,
    McpModule.forFeature([MigrationTool], 'continuum'),
  ],
  controllers: restEnabled ? [MigrationController] : [],
  providers: [MigrationService, MigrationTool],
  exports: [MigrationService],
})
export class MigrationModule {}
