import { Module } from '@nestjs/common';
import { EmbedderService } from './embedder.service';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [AppSettingsModule],
  providers: [EmbedderService],
  exports: [EmbedderService],
})
export class EmbedderModule {}
