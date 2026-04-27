import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentServiceError,
  KnowledgeUpdateError,
  PlotServiceError,
  ProjectServiceError,
} from './service-errors';

export function mapServiceError(err: unknown): never {
  if (err instanceof ProjectServiceError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    if (err.reason === 'project_exists') {
      throw new ConflictException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof KnowledgeUpdateError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof PlotServiceError) {
    if (err.reason === 'project_not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  if (err instanceof AgentServiceError) {
    if (err.reason === 'project_not_found' || err.reason === 'not_found') {
      throw new NotFoundException({ reason: err.reason, detail: err.detail });
    }
    if (err.reason === 'slug_conflict') {
      throw new ConflictException({ reason: err.reason, detail: err.detail });
    }
    throw new BadRequestException({ reason: err.reason, detail: err.detail });
  }
  throw err;
}
