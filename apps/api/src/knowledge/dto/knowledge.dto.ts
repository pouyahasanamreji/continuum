// Parity-shell: lite ref of Knowledge for nested DTO references. No current consumer.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { z } from 'zod';

export const knowledgeDto = z.object({
  id: z.number(),
});
export type KnowledgeDtoInput = z.infer<typeof knowledgeDto>;

export class KnowledgeDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}
