import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeKindEnum } from '../../knowledge-kinds/knowledge-kinds.enum';

export class KnowledgeSummary {
  @ApiProperty({ type: String, example: 'lesson-on-cascades' })
  slug!: string;

  @ApiProperty({ enum: KnowledgeKindEnum, example: 'situational' })
  kind!: KnowledgeKindEnum;

  @ApiProperty({ type: String, example: 'alpha' })
  agentSlug!: string;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}
