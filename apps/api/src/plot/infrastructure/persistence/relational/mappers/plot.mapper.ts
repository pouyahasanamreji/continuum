import { Plot } from '../../../../domain/plot';
import { PlotEntity } from '../entities/plot.entity';

export class PlotMapper {
  static toDomain(raw: PlotEntity): Plot {
    const p = new Plot();
    p.id = raw.id;
    p.projectId = raw.project_id;
    p.content = raw.content;
    p.createdAt = new Date(raw.created_at);
    p.updatedAt = new Date(raw.updated_at);
    p.deletedAt = raw.deleted_at !== null ? new Date(raw.deleted_at) : null;
    return p;
  }
}
