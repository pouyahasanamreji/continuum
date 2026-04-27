import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { z } from 'zod';
import { CreateProjectDto } from './create-project.dto';

export const renameProjectDto = z.object({
  path: z.string(),
  name: z.string(),
});
export type RenameProjectInput = z.infer<typeof renameProjectDto>;

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ type: String, example: 'My Project' })
  @IsOptional()
  @IsString()
  name?: string;
}
