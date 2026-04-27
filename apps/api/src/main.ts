import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  UnprocessableEntityException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '5mb' });

  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const errs: Record<string, string> = {};
        for (const e of errors) {
          const constraints = Object.keys(e.constraints ?? {});
          errs[e.property] = constraints[0] ?? 'invalid';
        }
        return new UnprocessableEntityException({ status: 422, errors: errs });
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Continuum API')
    .setDescription('Orchestrator REST surface for the panel + tooling.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  if (process.env.CORS_ORIGIN) {
    app.enableCors({
      origin:
        process.env.CORS_ORIGIN === '*'
          ? true
          : process.env.CORS_ORIGIN.split(','),
      credentials: false,
    });
  }
  await app.listen(process.env.PORT ?? 7776, '0.0.0.0');
}
void bootstrap();
