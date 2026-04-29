export type ProjectErrorReason =
  | 'invalid_path'
  | 'invalid_name'
  | 'project_exists'
  | 'project_not_found'
  | 'no_change';

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
      | 'no_current_content'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`plot operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'PlotServiceError';
  }
}

// `agent_not_found` is module-local; sibling modules use `not_found` for
// parent-resource misses. Promote to a shared reason set in a future cleanup
// if pattern recurs.
export class KnowledgeServiceError extends Error {
  constructor(
    public readonly reason:
      | 'project_not_found'
      | 'agent_not_found'
      | 'slug_conflict'
      | 'invalid_slug'
      | 'not_found'
      | 'no_change',
    public readonly detail?: string,
  ) {
    super(
      `knowledge operation failed: ${reason}${detail ? ` (${detail})` : ''}`,
    );
    this.name = 'KnowledgeServiceError';
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
      | 'artifacts_frozen'
      | 'no_change'
      | 'project_not_found',
    public readonly detail?: string,
  ) {
    super(`agent operation failed: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'AgentServiceError';
  }
}
