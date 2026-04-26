import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.CORS_ORIGIN) {
    app.enableCors({
      origin:
        process.env.CORS_ORIGIN === '*'
          ? true
          : process.env.CORS_ORIGIN.split(','),
      credentials: false,
    });
  }
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
