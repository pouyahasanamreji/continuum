import { Injectable } from '@nestjs/common';
import { OrchestratorDbService } from '../../../../../database/orchestrator-db.service';
import { Plot } from '../../../../domain/plot';
import { PlotApplyDiffPayload, PlotRepository } from '../../plot.repository';
import { PlotEntity } from '../entities/plot.entity';
import { PlotMapper } from '../mappers/plot.mapper';

@Injectable()
export class PlotRelationalRepository extends PlotRepository {
  constructor(private readonly dbs: OrchestratorDbService) {
    super();
  }

  findByProjectId(projectId: number): Plot | null {
    const row = this.dbs.db
      .prepare<
        [number],
        PlotEntity
      >('SELECT * FROM plots WHERE project_id = ? AND deleted_at IS NULL')
      .get(projectId);
    return row ? PlotMapper.toDomain(row) : null;
  }

  upsert(projectId: number, content: string, now: number): void {
    this.dbs.db
      .prepare(
        `INSERT INTO plots (project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(projectId, content, now, now);
  }

  applyDiff(projectId: number, payload: PlotApplyDiffPayload): void {
    const db = this.dbs.db;
    const tx = db.transaction(
      (pid: number, content: string, diff: string, ts: number) => {
        db.prepare(
          'INSERT INTO plot_history (project_id, content, applied_diff, created_at) VALUES (?, ?, ?, ?)',
        ).run(pid, content, diff, ts);
        db.prepare(
          'UPDATE plots SET content = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
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
