import { ApiProperty } from '@nestjs/swagger';

export class Project {
  @ApiProperty({ type: Number, example: 1 })
  id!: number;

  @ApiProperty({ type: String, example: '/Users/foo/proj' })
  path!: string;

  @ApiProperty({ type: String, example: 'proj' })
  name!: string;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;
}
