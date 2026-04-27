import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
} from '@nestjs/common';
import { PlotService } from './plot.service';
import { mapServiceError } from '../common/errors/map-service-error';

@Controller('api/orchestrator')
export class PlotController {
  constructor(private readonly plot: PlotService) {}

  @Get('plot')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getPlot(@Query('project') project?: string): string {
    if (!project) {
      throw new BadRequestException({ reason: 'missing_project_query' });
    }
    try {
      return this.plot.getForProject(project).content;
    } catch (e) {
      mapServiceError(e);
    }
  }
}
