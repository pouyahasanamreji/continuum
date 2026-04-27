import { Project } from '../../../../domain/project';
import { ProjectEntity } from '../entities/project.entity';

export class ProjectMapper {
  static toDomain(raw: ProjectEntity): Project {
    const p = new Project();
    p.path = raw.path;
    p.name = raw.name;
    p.createdAt = raw.created_at;
    p.updatedAt = raw.updated_at;
    return p;
  }
}
