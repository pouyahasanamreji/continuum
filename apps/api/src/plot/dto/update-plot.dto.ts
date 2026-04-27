// Diverges from ref pattern: NOT PartialType(CreatePlotDto). update is diff-application, not whole-content replace.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';

export const updatePlotDto = z.object({
  project: z.string(),
  diff: z.string().min(1),
});
export type UpdatePlotInput = z.infer<typeof updatePlotDto>;

export class UpdatePlotDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  diff!: string;
}
