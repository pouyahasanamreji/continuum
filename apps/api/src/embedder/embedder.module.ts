import { Module } from '@nestjs/common';
import { EmbedderService } from './embedder.service';
import { InprocessEmbedderService } from './inprocess-embedder';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [AppSettingsModule],
  providers: [EmbedderService, InprocessEmbedderService],
  exports: [EmbedderService, InprocessEmbedderService],
})
export class EmbedderModule {}
