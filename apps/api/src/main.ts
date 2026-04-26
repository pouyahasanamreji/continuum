import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '5mb' });
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
