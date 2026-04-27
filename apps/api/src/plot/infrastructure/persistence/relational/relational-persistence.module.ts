import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { PlotRepository } from '../plot.repository';
import { PlotRelationalRepository } from './repositories/plot.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PlotRepository,
      useClass: PlotRelationalRepository,
    },
  ],
  exports: [PlotRepository],
})
export class RelationalPlotPersistenceModule {}
