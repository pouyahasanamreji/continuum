import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../database/database.module';
import { AppSettingsRepository } from '../app-settings.repository';
import { AppSettingsRelationalRepository } from './repositories/app-settings.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AppSettingsRepository,
      useClass: AppSettingsRelationalRepository,
    },
  ],
  exports: [AppSettingsRepository],
})
export class RelationalAppSettingsPersistenceModule {}
