import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Knowledge } from '../../../../domain/knowledge';
import {
  KnowledgeApplyDiffPayload,
  KnowledgeRepository,
} from '../../knowledge.repository';
import { KnowledgeEntity } from '../entities/knowledge.entity';
import { KnowledgeMapper } from '../mappers/knowledge.mapper';

@Injectable()
export class KnowledgeRelationalRepository extends KnowledgeRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  findByProjectId(projectId: number): Knowledge | null {
    const row = this.dbs.db
      .prepare<
        [number],
        KnowledgeEntity
      >('SELECT * FROM knowledge WHERE project_id = ? AND deleted_at IS NULL')
      .get(projectId);
    return row ? KnowledgeMapper.toDomain(row) : null;
  }

  upsert(projectId: number, content: string, now: number): void {
    this.dbs.db
      .prepare(
        `INSERT INTO knowledge (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(projectId, content, now, now);
  }

  applyDiff(projectId: number, payload: KnowledgeApplyDiffPayload): void {
    const db = this.dbs.db;
    const tx = db.transaction(
      (pid: number, content: string, diff: string, ts: number) => {
        db.prepare(
          'INSERT INTO knowledge_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
        ).run(pid, content, diff, ts);
        db.prepare(
          'UPDATE knowledge SET content = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
        ).run(content, ts, pid);
      },
    );
    tx.immediate(
      projectId,
      payload.newContent,
      payload.unifiedDiff,
      payload.now,
    );
  }
}
