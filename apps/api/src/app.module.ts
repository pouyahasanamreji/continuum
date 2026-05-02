import { Module, type DynamicModule } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { ServeStaticModule } from '@nestjs/serve-static';
import { randomUUID } from 'node:crypto';

const panelStaticImports: DynamicModule[] = process.env.PANEL_STATIC_ROOT
  ? [
      ServeStaticModule.forRoot({
        rootPath: process.env.PANEL_STATIC_ROOT,
        serveRoot: '/panel',
        serveStaticOptions: { index: 'index.html', fallthrough: false },
      }),
    ]
  : [];
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ProjectModule } from './project/project.module';
import { PlotModule } from './plot/plot.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AgentModule } from './agent/agent.module';
import { TokenizerModule } from './tokenizer/tokenizer.module';
import { EmbedderModule } from './embedder/embedder.module';
import { AppSettingsModule } from './app-settings/app-settings.module';

@Module({
  imports: [
    ...panelStaticImports,
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
    TokenizerModule,
    EmbedderModule,
    AppSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
