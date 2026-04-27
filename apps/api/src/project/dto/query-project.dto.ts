import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Project } from '../domain/project';

export class FilterProjectDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  path?: string | null;
}

export class SortProjectDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy!: keyof Project;

  @ApiProperty()
  @IsString()
  order!: string;
}

export class QueryProjectDto {
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
      return plainToInstance(FilterProjectDto, JSON.parse(value));
    } catch {
      return undefined;
    }
  })
  @ValidateNested()
  @Type(() => FilterProjectDto)
  filters?: FilterProjectDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      return plainToInstance(SortProjectDto, JSON.parse(value));
    } catch {
      return undefined;
    }
  })
  @ValidateNested({ each: true })
  @Type(() => SortProjectDto)
  sort?: SortProjectDto[] | null;
}
