import { Agent } from '../../../../domain/agent';
import { AgentSummary } from '../../../../domain/agent-summary';
import { AgentEntity } from '../entities/agent.entity';

export class AgentMapper {
  static toDomain(raw: AgentEntity): Agent {
    const a = new Agent();
    a.id = raw.id;
    a.projectId = raw.project_id;
    a.slug = raw.slug;
    a.status = raw.status;
    a.branch = raw.branch;
    a.worktree = raw.worktree;
    a.reservedPaths = JSON.parse(raw.reserved_paths_json) as string[];
    a.request = raw.request;
    a.plan = raw.plan;
    a.implPrompt = raw.impl_prompt;
    a.coordinationBrief = raw.coordination_brief;
    a.postMergeNotes = raw.post_merge_notes;
    a.createdAt = new Date(raw.created_at);
    a.dispatchedAt =
      raw.dispatched_at !== null ? new Date(raw.dispatched_at) : null;
    a.updatedAt = new Date(raw.updated_at);
    a.mergedAt = raw.merged_at !== null ? new Date(raw.merged_at) : null;
    a.mergedCommit = raw.merged_commit;
    a.abandonedReason = raw.abandoned_reason;
    a.deletedAt = raw.deleted_at !== null ? new Date(raw.deleted_at) : null;
    return a;
  }

  static toSummary(raw: AgentEntity): AgentSummary {
    const s = new AgentSummary();
    s.slug = raw.slug;
    s.status = raw.status;
    s.branch = raw.branch;
    s.worktree = raw.worktree;
    s.reservedPaths = JSON.parse(raw.reserved_paths_json) as string[];
    s.createdAt = new Date(raw.created_at);
    s.dispatchedAt =
      raw.dispatched_at !== null ? new Date(raw.dispatched_at) : null;
    s.updatedAt = new Date(raw.updated_at);
    s.mergedAt = raw.merged_at !== null ? new Date(raw.merged_at) : null;
    s.mergedCommit = raw.merged_commit;
    s.abandonedReason = raw.abandoned_reason;
    return s;
  }
}
