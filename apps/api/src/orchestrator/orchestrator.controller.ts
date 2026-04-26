import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { PlotService } from './plot.service';
import { KnowledgeService } from './knowledge.service';
import { AgentService } from './agent.service';

@Controller('api/orchestrator')
export class OrchestratorController {
  constructor(
    private readonly plot: PlotService,
    private readonly knowledge: KnowledgeService,
    private readonly agents: AgentService,
  ) {}

  @Get('plot')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getPlot(): string {
    return this.plot.get();
  }

  @Get('knowledge')
  getKnowledge(@Query('section') section?: string) {
    if (section) {
      const text = this.knowledge.getSection(section);
      if (text === null)
        throw new NotFoundException(`Section "${section}" not found`);
      return { content: text, section };
    }
    const all = this.knowledge.getAll();
    if (!all) throw new NotFoundException('Knowledge document is empty');
    return all;
  }

  @Get('agents')
  listAgents() {
    return this.agents.list();
  }

  @Get('agents/:slug')
  getAgent(@Param('slug') slug: string) {
    const found = this.agents.get(slug);
    if (!found) throw new NotFoundException(`Agent "${slug}" not found`);
    return found;
  }
}
