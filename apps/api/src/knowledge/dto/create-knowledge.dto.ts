import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';
import { SLUG_RE } from '../../common/slug';

export const createKnowledgeDto = z.object({
  project: z.string(),
  agentSlug: z.string().regex(SLUG_RE),
  slug: z.string().regex(SLUG_RE),
  content: z.string(),
});
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeDto>;

export class CreateKnowledgeDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String, example: 'alpha' })
  @IsString()
  @IsNotEmpty()
  agentSlug!: string;

  @ApiProperty({ type: String, example: 'cascade-pitfall' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
