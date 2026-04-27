import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlotService } from './plot.service';
import { Plot } from './domain/plot';
import { QueryPlotDto } from './dto/query-plot.dto';
import { mapServiceError } from '../common/errors/map-service-error';

function missingProject(): never {
  throw new UnprocessableEntityException({
    status: 422,
    errors: { project: 'missingProjectQuery' },
  });
}

@ApiTags('Plot')
@Controller('api/orchestrator')
export class PlotController {
  constructor(private readonly plot: PlotService) {}

  @Get('plot')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: Plot })
  getPlot(@Query() query: QueryPlotDto): Plot {
    if (!query.project) missingProject();
    try {
      const found = this.plot.findOne(query.project);
      if (!found) {
        throw new NotFoundException({
          status: 404,
          errors: { plot: 'plotNotFound' },
        });
      }
      return found;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      mapServiceError(e);
    }
  }
}
