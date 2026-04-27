import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { z } from 'zod';

export const getAgentDto = z.object({
  project: z.string(),
  slug: z.string(),
});
export type GetAgentDto = z.infer<typeof getAgentDto>;

export class AgentDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}
