import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { DatabaseModule } from '../database/database.module';
import { PlotService } from './plot.service';
import { PlotTool } from './plot.tool';
import { PlotController } from './plot.controller';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    DatabaseModule,
    McpModule.forFeature([PlotTool], 'continuum'),
  ],
  controllers: restEnabled ? [PlotController] : [],
  providers: [PlotService, PlotTool],
  exports: [PlotService],
})
export class PlotModule {}
