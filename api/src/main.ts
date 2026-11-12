import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { correlationMiddleware } from './shared/correlation.js';
import { requiredEnv } from './shared/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // credentials: a UI (outra origem) precisa mandar e receber o cookie do refresh.
  // Com credentials, a origem tem que ser exata; nada de '*'.
  app.enableCors({ origin: requiredEnv('CORS_ORIGIN'), credentials: true, exposedHeaders: ['x-correlation-id'] });
  app.use(correlationMiddleware);
  app.use(cookieParser());
  // whitelist + forbidNonWhitelisted: campo fora do DTO vira 400 em vez de passar adiante.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  // Fecha o pool do Prisma no SIGTERM do `docker stop`.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
