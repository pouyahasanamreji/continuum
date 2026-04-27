// Parity-shell: lite ref of Plot for nested DTO references. No current consumer.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { z } from 'zod';

export const plotDto = z.object({
  id: z.number(),
});
export type PlotDtoInput = z.infer<typeof plotDto>;

export class PlotDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}
