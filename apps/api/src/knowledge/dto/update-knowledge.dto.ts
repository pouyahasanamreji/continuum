// Diverges from ref pattern: NOT PartialType(CreateKnowledgeDto). update is diff-application, not whole-content replace.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';

export const updateKnowledgeDto = z.object({
  project: z.string(),
  diff: z.string().min(1),
});
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeDto>;

export class UpdateKnowledgeDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  diff!: string;
}
