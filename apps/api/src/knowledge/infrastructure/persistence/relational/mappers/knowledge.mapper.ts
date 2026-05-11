import { Knowledge } from '../../../../domain/knowledge';
import { KnowledgeSummary } from '../../../../domain/knowledge-summary';
import { KnowledgeKindEnum } from '../../../../../knowledge-kinds/knowledge-kinds.enum';
import { KnowledgeEntity } from '../entities/knowledge.entity';

export interface KnowledgeSummaryRow {
  slug: string;
  kind: string;
  agent_slug: string;
  created_at: number;
  updated_at: number;
}

export class KnowledgeMapper {
  static toDomain(raw: KnowledgeEntity): Knowledge {
    const k = new Knowledge();
    k.id = raw.id;
    k.projectId = raw.project_id;
    k.agentId = raw.agent_id;
    k.slug = raw.slug;
    k.content = raw.content;
    k.kind = raw.kind as KnowledgeKindEnum;
    k.createdAt = new Date(raw.created_at);
    k.updatedAt = new Date(raw.updated_at);
    k.deletedAt = raw.deleted_at !== null ? new Date(raw.deleted_at) : null;
    return k;
  }

  static toSummary(raw: KnowledgeSummaryRow): KnowledgeSummary {
    const s = new KnowledgeSummary();
    s.slug = raw.slug;
    s.kind = raw.kind as KnowledgeKindEnum;
    s.agentSlug = raw.agent_slug;
    s.createdAt = new Date(raw.created_at);
    s.updatedAt = new Date(raw.updated_at);
    return s;
  }
}
