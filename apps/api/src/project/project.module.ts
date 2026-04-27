import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { PlotModule } from '../plot/plot.module';
import { ProjectService } from './project.service';
import { ProjectTool } from './project.tool';
import { ProjectController } from './project.controller';
import { RelationalProjectPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    PlotModule,
    RelationalProjectPersistenceModule,
    McpModule.forFeature([ProjectTool], 'continuum'),
  ],
  controllers: restEnabled ? [ProjectController] : [],
  providers: [ProjectService, ProjectTool],
  exports: [ProjectService, RelationalProjectPersistenceModule],
})
export class ProjectModule {}
