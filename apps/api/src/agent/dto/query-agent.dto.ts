import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Agent } from '../domain/agent';

export class FilterAgentDto {
  @ApiPropertyOptional({
    type: String,
    enum: ['draft', 'active', 'merged', 'abandoned'],
  })
  @IsOptional()
  @IsEnum(['draft', 'active', 'merged', 'abandoned'])
  status?: 'draft' | 'active' | 'merged' | 'abandoned' | null;
}

export class SortAgentDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy!: keyof Agent;

  @ApiProperty()
  @IsString()
  order!: string;
}

export class QueryAgentDto {
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
    value ? plainToInstance(FilterAgentDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterAgentDto)
  filters?: FilterAgentDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(SortAgentDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => SortAgentDto)
  sort?: SortAgentDto[] | null;
}
