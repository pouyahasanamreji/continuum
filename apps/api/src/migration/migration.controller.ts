import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { mapServiceError } from '../common/errors/map-service-error';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { migrateProjectDto } from './dto/migrate-project.dto';
import type { MigrateProjectDto } from './dto/migrate-project.dto';

@Controller('api/orchestrator')
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post('projects/migrate')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(migrateProjectDto))
  migrateProject(@Body() body: MigrateProjectDto) {
    try {
      return this.migration.migrate(body);
    } catch (e) {
      mapServiceError(e);
    }
  }
}
