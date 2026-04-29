import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { z } from 'zod';

export const getKnowledgeDto = z.object({
  project: z.string(),
  slug: z.string(),
});
export type GetKnowledgeDto = z.infer<typeof getKnowledgeDto>;

export class KnowledgeDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}
