import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { ProjectRepository } from '../project.repository';
import { ProjectRelationalRepository } from './repositories/project.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: ProjectRepository,
      useClass: ProjectRelationalRepository,
    },
  ],
  exports: [ProjectRepository],
})
export class RelationalProjectPersistenceModule {}
