import { Project } from '../../../../domain/project';
import { ProjectEntity } from '../entities/project.entity';

export class ProjectMapper {
  static toDomain(raw: ProjectEntity): Project {
    const p = new Project();
    p.id = raw.id;
    p.path = raw.path;
    p.name = raw.name;
    p.createdAt = new Date(raw.created_at);
    p.updatedAt = new Date(raw.updated_at);
    p.deletedAt = raw.deleted_at !== null ? new Date(raw.deleted_at) : null;
    return p;
  }

  static toPersistence(domain: Project): ProjectEntity {
    return {
      id: domain.id,
      path: domain.path,
      name: domain.name,
      created_at: domain.createdAt.getTime(),
      updated_at: domain.updatedAt.getTime(),
      deleted_at: domain.deletedAt ? domain.deletedAt.getTime() : null,
    };
  }
}
