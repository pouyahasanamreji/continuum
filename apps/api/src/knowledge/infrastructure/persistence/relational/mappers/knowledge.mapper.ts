import { Knowledge } from '../../../../domain/knowledge';
import { KnowledgeEntity } from '../entities/knowledge.entity';

export class KnowledgeMapper {
  static toDomain(raw: KnowledgeEntity): Knowledge {
    const k = new Knowledge();
    k.id = raw.id;
    k.projectId = raw.project_id;
    k.content = raw.content;
    k.createdAt = new Date(raw.created_at);
    k.updatedAt = new Date(raw.updated_at);
    k.deletedAt = raw.deleted_at !== null ? new Date(raw.deleted_at) : null;
    return k;
  }
}
