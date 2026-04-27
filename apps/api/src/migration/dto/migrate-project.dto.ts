import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { z } from 'zod';

export const migrateProjectDto = z.object({
  path: z.string(),
  name: z.string().optional(),
  plotContent: z.string().optional(),
  knowledgeContent: z.string().optional(),
  agents: z
    .array(z.object({ slug: z.string(), content: z.string() }))
    .max(200)
    .default([]),
});
export type MigrateProjectInput = z.infer<typeof migrateProjectDto>;

export class MigrateAgentDto {
  @ApiProperty({ type: String, example: 'alpha' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ type: String })
  @IsString()
  content!: string;
}

export class MigrateProjectDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  plotContent?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  knowledgeContent?: string;

  @ApiPropertyOptional({ type: () => [MigrateAgentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MigrateAgentDto)
  agents?: MigrateAgentDto[];
}
