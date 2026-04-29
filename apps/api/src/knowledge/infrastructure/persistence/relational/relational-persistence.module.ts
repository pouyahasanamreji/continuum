import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { KnowledgeRepository } from '../knowledge.repository';
import { KnowledgeVectorRepository } from '../knowledge-vector.repository';
import { KnowledgeRelationalRepository } from './repositories/knowledge.repository';
import { RelationalKnowledgeVectorRepository } from './repositories/relational-knowledge-vector.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: KnowledgeRepository,
      useClass: KnowledgeRelationalRepository,
    },
    {
      provide: KnowledgeVectorRepository,
      useClass: RelationalKnowledgeVectorRepository,
    },
  ],
  exports: [KnowledgeRepository, KnowledgeVectorRepository],
})
export class RelationalKnowledgePersistenceModule {}
