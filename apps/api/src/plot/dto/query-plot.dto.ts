import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { z } from 'zod';
import { Plot } from '../domain/plot';

export const getPlotDto = z.object({
  project: z.string(),
});
export type GetPlotDto = z.infer<typeof getPlotDto>;

export class FilterPlotDto {}

export class SortPlotDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy!: keyof Plot;

  @ApiProperty()
  @IsString()
  order!: string;
}

export class QueryPlotDto {
  @ApiProperty({ type: String })
  @IsString()
  project!: string;

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
    value ? plainToInstance(FilterPlotDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterPlotDto)
  filters?: FilterPlotDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortPlotDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortPlotDto)
  sort?: SortPlotDto[] | null;
}
