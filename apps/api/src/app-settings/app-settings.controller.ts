import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppSettingsService } from './app-settings.service';
import { AppSettingsResponseDto } from './dto/app-settings-response.dto';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

@ApiTags('AppSettings')
@Controller('api/orchestrator')
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AppSettingsResponseDto })
  getSettings(): AppSettingsResponseDto {
    return this.settings.readAllForPanel();
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AppSettingsResponseDto })
  patchSettings(@Body() body: UpdateAppSettingsDto): AppSettingsResponseDto {
    this.settings.applyPanelPatch(body);
    return this.settings.readAllForPanel();
  }
}
