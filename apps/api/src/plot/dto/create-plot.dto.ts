// Reserved for future REST POST /plot endpoint. No current consumer.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { z } from 'zod';

export const createPlotDto = z.object({
  project: z.string(),
  content: z.string(),
});
export type CreatePlotInput = z.infer<typeof createPlotDto>;

export class CreatePlotDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String })
  @IsString()
  content!: string;
}
