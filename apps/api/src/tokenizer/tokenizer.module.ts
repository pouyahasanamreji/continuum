import { Module } from '@nestjs/common';
import { TokenizerService } from './tokenizer.service';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
  imports: [AppSettingsModule],
  providers: [TokenizerService],
  exports: [TokenizerService],
})
export class TokenizerModule {}
