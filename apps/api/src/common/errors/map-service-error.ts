import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AgentServiceError,
  KnowledgeUpdateError,
  PlotServiceError,
  ProjectServiceError,
} from './service-errors';

function unprocessable(field: string, code: string): never {
  throw new UnprocessableEntityException({
    status: 422,
    errors: { [field]: code },
  });
}

function notFound(field: string, code: string): never {
  throw new NotFoundException({
    status: 404,
    errors: { [field]: code },
  });
}

function conflict(field: string, code: string): never {
  throw new ConflictException({
    status: 409,
    errors: { [field]: code },
  });
}

export function mapServiceError(err: unknown): never {
  if (err instanceof ProjectServiceError) {
    switch (err.reason) {
      case 'project_not_found':
        notFound('project', 'projectNotFound');
        break;
      case 'project_exists':
        conflict('path', 'projectAlreadyExists');
        break;
      case 'invalid_path':
        unprocessable('path', 'invalidPath');
        break;
      case 'invalid_name':
        unprocessable('name', 'invalidName');
        break;
      case 'no_change':
        unprocessable('project', 'noChange');
        break;
    }
  }

  if (err instanceof KnowledgeUpdateError) {
    switch (err.reason) {
      case 'project_not_found':
        notFound('project', 'projectNotFound');
        break;
      case 'invalid_diff_headers':
        unprocessable('diff', 'invalidDiffHeaders');
        break;
      case 'parse_failed':
        unprocessable('diff', 'parseFailed');
        break;
      case 'hunk_mismatch':
        unprocessable('diff', 'hunkMismatch');
        break;
      case 'no_current_content':
        unprocessable('knowledge', 'noCurrentContent');
        break;
    }
  }

  if (err instanceof PlotServiceError) {
    switch (err.reason) {
      case 'project_not_found':
        notFound('project', 'projectNotFound');
        break;
      case 'invalid_diff_headers':
        unprocessable('plot', 'invalidDiffHeaders');
        break;
      case 'parse_failed':
        unprocessable('plot', 'parseFailed');
        break;
      case 'hunk_mismatch':
        unprocessable('plot', 'hunkMismatch');
        break;
      case 'no_current_content':
        unprocessable('plot', 'noCurrentContent');
        break;
    }
  }

  if (err instanceof AgentServiceError) {
    switch (err.reason) {
      case 'not_found':
        notFound('agent', 'agentNotFound');
        break;
      case 'project_not_found':
        notFound('project', 'projectNotFound');
        break;
      case 'slug_conflict':
        conflict('slug', 'slugConflict');
        break;
      case 'invalid_slug':
        unprocessable('slug', 'invalidSlug');
        break;
      case 'invalid_transition':
        unprocessable('status', 'invalidTransition');
        break;
      case 'missing_merged_commit':
        unprocessable('mergedCommit', 'missingMergedCommit');
        break;
      case 'invalid_merged_commit':
        unprocessable('mergedCommit', 'invalidMergedCommit');
        break;
      case 'missing_abandoned_reason':
        unprocessable('abandonedReason', 'missingAbandonedReason');
        break;
      case 'artifacts_frozen':
        unprocessable('agent', 'artifactsFrozen');
        break;
      case 'no_change':
        unprocessable('agent', 'noChange');
        break;
    }
  }

  throw err;
}
