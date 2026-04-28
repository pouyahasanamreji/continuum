import { ApiProperty } from '@nestjs/swagger';

export class AppSettingsEffectiveDto {
  @ApiProperty({ enum: ['db', 'env', 'unset'] })
  anthropicApiKey!: 'db' | 'env' | 'unset';

  @ApiProperty({ enum: ['db', 'env', 'default'] })
  anthropicTokenizerModel!: 'db' | 'env' | 'default';
}

export class AppSettingsResponseDto {
  @ApiProperty({ type: String, nullable: true })
  anthropicApiKey!: string | null;

  @ApiProperty({ type: String, nullable: true })
  anthropicTokenizerModel!: string | null;

  @ApiProperty({ type: AppSettingsEffectiveDto })
  effective!: AppSettingsEffectiveDto;
}
