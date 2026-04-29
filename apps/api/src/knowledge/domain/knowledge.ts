import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeKindEnum } from '../../knowledge-kinds/knowledge-kinds.enum';

export class Knowledge {
  @ApiProperty({ type: Number, example: 1 })
  id!: number;

  @ApiProperty({ type: Number, example: 1 })
  projectId!: number;

  @ApiProperty({ type: Number, example: 1 })
  agentId!: number;

  @ApiProperty({ type: String, example: 'lesson-on-cascades' })
  slug!: string;

  @ApiProperty({ type: String })
  content!: string;

  @ApiProperty({ enum: KnowledgeKindEnum, example: 'situational' })
  kind!: KnowledgeKindEnum;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;
}
