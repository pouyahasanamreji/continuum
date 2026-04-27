import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class AgentDto {
  @ApiProperty({ type: Number, example: 1 })
  @IsNotEmpty()
  id!: number;
}
