import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { DatabaseModule } from '../database/database.module';
import { RelationalProjectPersistenceModule } from '../project/infrastructure/persistence/relational/relational-persistence.module';
import { PlotService } from './plot.service';
import { PlotTool } from './plot.tool';
import { PlotController } from './plot.controller';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    DatabaseModule,
    RelationalProjectPersistenceModule,
    McpModule.forFeature([PlotTool], 'continuum'),
  ],
  controllers: restEnabled ? [PlotController] : [],
  providers: [PlotService, PlotTool],
  exports: [PlotService],
})
export class PlotModule {}
