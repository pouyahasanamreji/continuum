import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { z } from 'zod';
import { SLUG_RE } from '../../common/slug';

export const createAgentDto = z.object({
  project: z.string(),
  slug: z.string().regex(SLUG_RE),
  branch: z.string(),
  worktree: z.string(),
  reservedPaths: z.array(z.string()).default([]),
  request: z.string(),
  plan: z.string(),
  implPrompt: z.string(),
  coordinationBrief: z.string(),
});
export type CreateAgentInput = z.infer<typeof createAgentDto>;

export class CreateAgentDto {
  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  @IsString()
  @IsNotEmpty()
  project!: string;

  @ApiProperty({ type: String, example: 'alpha' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ type: String, example: 'feat/alpha' })
  @IsString()
  @IsNotEmpty()
  branch!: string;

  @ApiProperty({ type: String, example: '/tmp/wt' })
  @IsString()
  @IsNotEmpty()
  worktree!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reservedPaths?: string[];

  @ApiProperty({ type: String })
  @IsString()
  request!: string;

  @ApiProperty({ type: String })
  @IsString()
  plan!: string;

  @ApiProperty({ type: String })
  @IsString()
  implPrompt!: string;

  @ApiProperty({ type: String })
  @IsString()
  coordinationBrief!: string;
}
