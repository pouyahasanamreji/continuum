import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ProjectModule } from './project/project.module';
import { PlotModule } from './plot/plot.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AgentModule } from './agent/agent.module';
import { MigrationModule } from './migration/migration.module';
import { TokenizerModule } from './tokenizer/tokenizer.module';

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
    DatabaseModule,
    ProjectModule,
    PlotModule,
    KnowledgeModule,
    AgentModule,
    MigrationModule,
    TokenizerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
