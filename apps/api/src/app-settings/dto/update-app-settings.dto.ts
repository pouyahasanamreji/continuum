import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAppSettingsDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  anthropicTokenizerModel?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  embedderUrl?: string;
}
