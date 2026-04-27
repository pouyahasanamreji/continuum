import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { z } from 'zod';
import { Knowledge } from '../domain/knowledge';

export const getKnowledgeDto = z.object({
  project: z.string(),
  section: z.string().optional(),
});
export type GetKnowledgeDto = z.infer<typeof getKnowledgeDto>;

export class FilterKnowledgeDto {}

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
  section?: string;

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
  @Transform(({ value }) =>
    value ? plainToInstance(FilterKnowledgeDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterKnowledgeDto)
  filters?: FilterKnowledgeDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortKnowledgeDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortKnowledgeDto)
  sort?: SortKnowledgeDto[] | null;
}
