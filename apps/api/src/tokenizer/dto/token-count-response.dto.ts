import { ApiProperty } from '@nestjs/swagger';

export class TokenCountResponseDto {
  @ApiProperty({ type: Number, example: 12345 })
  inputTokens!: number;

  @ApiProperty({ type: String, example: 'claude-opus-4-7' })
  model!: string;
}
