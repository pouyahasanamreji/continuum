import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { z } from 'zod';
import { Knowledge } from '../domain/knowledge';
import { KnowledgeKindEnum } from '../../knowledge-kinds/knowledge-kinds.enum';

export const listKnowledgeDto = z.object({ project: z.string() });
export type ListKnowledgeDto = z.infer<typeof listKnowledgeDto>;

export const searchKnowledgeDto = z
  .object({
    project: z.string(),
    q: z.string().min(1).optional(),
    kind: z.enum(['fundamental', 'situational']).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .refine((v) => v.q !== undefined || v.kind !== undefined, {
    message: 'q or kind required',
    path: ['q'],
  });
export type SearchKnowledgeDto = z.infer<typeof searchKnowledgeDto>;

export class FilterKnowledgeDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  agentSlug?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiPropertyOptional({ enum: KnowledgeKindEnum })
  @IsOptional()
  @IsEnum(KnowledgeKindEnum)
  kind?: KnowledgeKindEnum | null;
}

export class SortKnowledgeDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy!: keyof Knowledge;

  @ApiProperty()
  @IsString()
  order!: string;
}

export class QueryKnowledgeDto {
  @ApiProperty({ type: String })
  @IsString()
  project!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      return plainToInstance(FilterKnowledgeDto, JSON.parse(value));
    } catch {
      return undefined;
    }
  })
  @ValidateNested()
  @Type(() => FilterKnowledgeDto)
  filters?: FilterKnowledgeDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      return plainToInstance(SortKnowledgeDto, JSON.parse(value));
    } catch {
      return undefined;
    }
  })
  @ValidateNested({ each: true })
  @Type(() => SortKnowledgeDto)
  sort?: SortKnowledgeDto[] | null;
}
