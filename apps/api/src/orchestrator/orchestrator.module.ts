import { DynamicModule, Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { randomUUID } from 'node:crypto';
import { AgentService } from './agent.service';
import { AgentTool } from './agent.tool';
import { OrchestratorDbService } from './db.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTool } from './knowledge.tool';
import { PlotService } from './plot.service';
import { PlotTool } from './plot.tool';
import { ProjectService } from './project.service';
import { ProjectTool } from './project.tool';
import { OrchestratorController } from './orchestrator.controller';

@Module({})
export class OrchestratorModule {
  static forRoot(): DynamicModule {
    const restEnabled = process.env.PANEL_REST_ENABLED === 'true';
    return {
      module: OrchestratorModule,
      imports: [
        McpModule.forRoot({
          name: 'continuum',
          version: '0.1.0',
          transport: [McpTransportType.STREAMABLE_HTTP],
          streamableHttp: {
            statelessMode: false,
            sessionIdGenerator: () => randomUUID(),
          },
        }),
      ],
      controllers: restEnabled ? [OrchestratorController] : [],
      providers: [
        OrchestratorDbService,
        ProjectService,
        KnowledgeService,
        AgentService,
        PlotService,
        ProjectTool,
        PlotTool,
        KnowledgeTool,
        AgentTool,
      ],
    };
  }
}
