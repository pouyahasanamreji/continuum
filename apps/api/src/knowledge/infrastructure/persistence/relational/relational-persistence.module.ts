import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { KnowledgeRepository } from '../knowledge.repository';
import { KnowledgeRelationalRepository } from './repositories/knowledge.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: KnowledgeRepository,
      useClass: KnowledgeRelationalRepository,
    },
  ],
  exports: [KnowledgeRepository],
})
export class RelationalKnowledgePersistenceModule {}
