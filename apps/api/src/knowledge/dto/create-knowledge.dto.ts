// Reserved for future REST POST /knowledge endpoint. No current consumer.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';

export const createKnowledgeDto = z.object({
  project: z.string(),
  content: z.string(),
});
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeDto>;

export class CreateKnowledgeDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String })
  @IsString()
  content!: string;
}
