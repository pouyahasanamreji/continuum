import { ApiProperty } from '@nestjs/swagger';

export class Plot {
  @ApiProperty({ type: Number, example: 1 })
  id!: number;

  @ApiProperty({ type: Number, example: 1 })
  projectId!: number;

  @ApiProperty({ type: String })
  content!: string;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;
}
