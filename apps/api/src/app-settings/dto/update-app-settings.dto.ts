import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  embedderModel?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 4096 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  embedderDim?: number;
}
