export type ProjectErrorReason =
  | 'invalid_path'
  | 'invalid_name'
  | 'project_exists'
  | 'project_not_found';

export class ProjectServiceError extends Error {
  constructor(
    public readonly reason: ProjectErrorReason,
    public readonly detail?: string,
  ) {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
    this.name = 'ProjectServiceError';
  }
}

export class PlotServiceError extends Error {
  constructor(
    public readonly reason:
      | 'invalid_diff_headers'
      | 'parse_failed'
      | 'hunk_mismatch'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`plot operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'PlotServiceError';
  }
}

export class KnowledgeUpdateError extends Error {
  constructor(
    public readonly reason:
      | 'invalid_diff_headers'
      | 'parse_failed'
      | 'hunk_mismatch'
      | 'no_current_content'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`knowledge_update failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'KnowledgeUpdateError';
  }
}

export class AgentServiceError extends Error {
  constructor(
    public readonly reason:
      | 'slug_conflict'
      | 'invalid_slug'
      | 'not_found'
      | 'invalid_transition'
      | 'missing_merged_commit'
      | 'invalid_merged_commit'
      | 'missing_abandoned_reason'
      | 'no_change'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`agent operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'AgentServiceError';
  }
}
