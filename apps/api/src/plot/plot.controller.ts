import {
  Controller,
  Get,
  Header,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlotService } from './plot.service';
import { mapServiceError } from '../common/errors/map-service-error';

@ApiTags('Plot')
@Controller('api/orchestrator')
export class PlotController {
  constructor(private readonly plot: PlotService) {}

  @Get('plot')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'project', type: String, required: true })
  @ApiOkResponse({ description: 'Plot markdown body for the project.' })
  getPlot(@Query('project') project?: string): string {
    if (!project) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { project: 'missingProjectQuery' },
      });
    }
    try {
      return this.plot.getForProject(project).content;
    } catch (e) {
      mapServiceError(e);
    }
  }
}
