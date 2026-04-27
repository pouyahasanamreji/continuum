// Dual DTO: zod schemas for MCP @Tool params, class-validator class for REST.
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { z } from 'zod';

export const pathOnlyDto = z.object({ path: z.string() });
export type PathOnlyDto = z.infer<typeof pathOnlyDto>;

export class ProjectDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}

export class ProjectDeleteResponseDto {
  @ApiProperty({ type: Boolean })
  deleted!: boolean;

  @ApiProperty({ type: 'integer', example: 3 })
  cascadedAgents!: number;
}
