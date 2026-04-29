// Reverts `knowledge-module-cleanup` lesson #5 divergence — update is now
// whole-content replace, so PartialType is the correct base.
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { z } from 'zod';
import { CreateKnowledgeDto } from './create-knowledge.dto';
import { SLUG_RE } from '../../common/slug';

export const updateKnowledgeDto = z.object({
  project: z.string(),
  slug: z.string(),
  agentSlug: z.string().regex(SLUG_RE).optional(),
  content: z.string().optional(),
});
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeDto>;

export class UpdateKnowledgeDto extends PartialType(CreateKnowledgeDto) {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  agentSlug?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}
