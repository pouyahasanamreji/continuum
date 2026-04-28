import { Module } from '@nestjs/common';
import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';
import { RelationalAppSettingsPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const restEnabled = process.env.PANEL_REST_ENABLED === 'true';

@Module({
  imports: [RelationalAppSettingsPersistenceModule],
  providers: [AppSettingsService],
  controllers: restEnabled ? [AppSettingsController] : [],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
