import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum VectorizeMode {
  Missing = 'missing',
  All = 'all',
}

export class VectorizeKnowledgeDto {
  @ApiProperty({ enum: VectorizeMode })
  @IsEnum(VectorizeMode)
  mode!: VectorizeMode;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 4096 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  targetDim?: number;
}

export class VectorizeKnowledgeResultDto {
  @ApiProperty() processed!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty() errors!: number;
  @ApiProperty() durationMs!: number;
}

export class VectorizeProfileDto {
  @ApiPropertyOptional({ nullable: true }) url!: string | null;
  @ApiProperty() model!: string;
  @ApiProperty() dim!: number;
  @ApiProperty() configured!: boolean;
  @ApiPropertyOptional({ nullable: true }) signature!: string | null;
}

export class VectorizeStatusDto {
  @ApiProperty() totalKnowledge!: number;
  @ApiProperty() totalVectors!: number;
  @ApiProperty() fresh!: number;
  @ApiProperty() missing!: number;
  @ApiProperty() needed!: number;
  @ApiProperty() stale!: number;
  @ApiProperty() currentDim!: number;
  @ApiProperty() targetDim!: number;
  @ApiProperty({ type: VectorizeProfileDto }) profile!: VectorizeProfileDto;
}
