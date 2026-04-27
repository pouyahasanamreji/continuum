import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { z } from 'zod';

export const createProjectDto = z.object({
  path: z.string(),
  name: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectDto>;

export class CreateProjectDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiProperty({ type: String, required: false, example: 'My Project' })
  @IsOptional()
  @IsString()
  name?: string;
}
