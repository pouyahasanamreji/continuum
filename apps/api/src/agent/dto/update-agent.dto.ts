import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { z } from 'zod';
import { CreateAgentDto } from './create-agent.dto';

export const updateAgentDto = z.object({
  project: z.string(),
  slug: z.string(),
  status: z.enum(['active', 'merged', 'abandoned']).optional(),
  reservedPaths: z.array(z.string()).optional(),
  postMergeNotes: z.string().optional(),
  mergedCommit: z.string().optional(),
  abandonedReason: z.string().optional(),
  plan: z.string().min(1).optional(),
  implPrompt: z.string().min(1).optional(),
  coordinationBrief: z.string().min(1).optional(),
});
export type UpdateAgentInput = z.infer<typeof updateAgentDto>;

export class UpdateAgentDto extends PartialType(CreateAgentDto) {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiPropertyOptional({
    type: String,
    enum: ['active', 'merged', 'abandoned'],
  })
  @IsOptional()
  @IsEnum(['active', 'merged', 'abandoned'])
  status?: 'active' | 'merged' | 'abandoned';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reservedPaths?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  postMergeNotes?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  mergedCommit?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  abandonedReason?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  plan?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  implPrompt?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  coordinationBrief?: string;
}
