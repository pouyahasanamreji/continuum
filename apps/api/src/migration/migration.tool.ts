import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { MigrationService } from './migration.service';
import { ProjectServiceError } from '../common/errors/service-errors';
import { migrateProjectDto } from './dto/migrate-project.dto';
import type { MigrateProjectInput } from './dto/migrate-project.dto';

function toolError(err: unknown) {
  const msg =
    err instanceof ProjectServiceError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    content: [{ type: 'text' as const, text: msg }],
    isError: true,
  };
}

function toolSuccess(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

@Injectable()
export class MigrationTool {
  constructor(private readonly migration: MigrationService) {}

  @Tool({
    name: 'project_migrate',
    description:
      "Upsert a project's plot/knowledge/agents from raw markdown. Creates project if missing. Never deletes.",
    parameters: migrateProjectDto,
  })
  projectMigrate(args: MigrateProjectInput) {
    try {
      return toolSuccess(this.migration.migrate(args));
    } catch (e) {
      return toolError(e);
    }
  }
}
