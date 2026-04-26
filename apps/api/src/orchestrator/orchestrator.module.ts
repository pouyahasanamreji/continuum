import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { randomUUID } from 'node:crypto';
import { AgentService } from './agent.service';
import { AgentTool } from './agent.tool';
import { OrchestratorDbService } from './db.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTool } from './knowledge.tool';
import { PlotTool } from './plot.tool';

@Module({
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
  providers: [
    OrchestratorDbService,
    KnowledgeService,
    AgentService,
    PlotTool,
    KnowledgeTool,
    AgentTool,
  ],
})
export class OrchestratorModule {}
