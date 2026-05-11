import { ApiProperty } from '@nestjs/swagger';
import { AgentStatusEnum } from '../../agent-statuses/agent-statuses.enum';

export class AgentSummary {
  @ApiProperty({ type: String, example: 'alpha' })
  slug!: string;

  @ApiProperty({
    type: String,
    enum: ['draft', 'active', 'merged', 'abandoned'],
    example: 'draft',
  })
  status!: AgentStatusEnum;

  @ApiProperty({ type: String, example: 'feat/alpha' })
  branch!: string;

  @ApiProperty({ type: String, example: '/tmp/wt' })
  worktree!: string;

  @ApiProperty({ type: [String] })
  reservedPaths!: string[];

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  dispatchedAt!: Date | null;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  mergedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  mergedCommit!: string | null;

  @ApiProperty({ type: String, nullable: true })
  abandonedReason!: string | null;
}
