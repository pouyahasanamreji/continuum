import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { AgentRepository } from '../agent.repository';
import { AgentRelationalRepository } from './repositories/agent.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AgentRepository,
      useClass: AgentRelationalRepository,
    },
  ],
  exports: [AgentRepository],
})
export class RelationalAgentPersistenceModule {}
