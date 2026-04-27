import { Agent } from '../../../../domain/agent';
import { AgentEntity } from '../entities/agent.entity';

export class AgentMapper {
  static toDomain(raw: AgentEntity): Agent {
    const a = new Agent();
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
    a.createdAt = raw.created_at;
    a.dispatchedAt = raw.dispatched_at;
    a.updatedAt = raw.updated_at;
    a.mergedAt = raw.merged_at;
    a.mergedCommit = raw.merged_commit;
    a.abandonedReason = raw.abandoned_reason;
    return a;
  }
}
