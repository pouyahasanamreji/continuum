import { Module } from '@nestjs/common';
import { OrchestratorDbService } from './orchestrator-db.service';

@Module({
  providers: [OrchestratorDbService],
  exports: [OrchestratorDbService],
})
export class DatabaseModule {}
