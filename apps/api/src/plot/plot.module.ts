import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { RelationalProjectPersistenceModule } from '../project/infrastructure/persistence/relational/relational-persistence.module';
import { PlotService } from './plot.service';
import { PlotTool } from './plot.tool';
import { PlotController } from './plot.controller';
import { RelationalPlotPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { TokenizerModule } from '../tokenizer/tokenizer.module';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [
    RelationalProjectPersistenceModule,
    RelationalPlotPersistenceModule,
    McpModule.forFeature([PlotTool], 'continuum'),
    TokenizerModule,
  ],
  controllers: restEnabled ? [PlotController] : [],
  providers: [PlotService, PlotTool],
  exports: [PlotService, RelationalPlotPersistenceModule],
})
export class PlotModule {}
