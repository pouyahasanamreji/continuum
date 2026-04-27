import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { MigrationService } from './migration.service';
import type { MigrationResult } from './migration.service';
import { mapServiceError } from '../common/errors/map-service-error';
import { MigrateProjectDto } from './dto/migrate-project.dto';

@ApiTags('Migration')
@Controller('api/orchestrator')
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post('projects/migrate')
  @HttpCode(HttpStatus.OK)
  @ApiCreatedResponse({
    description:
      'Migration result. projectPath is preserved as a string for the panel.',
  })
  migrateProject(@Body() body: MigrateProjectDto): MigrationResult {
    try {
      return this.migration.migrate(body);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
