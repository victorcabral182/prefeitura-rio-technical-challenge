import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { correlationMiddleware } from './shared/correlation.js';
import { requiredEnv } from './shared/env.js';
import { httpMetrics } from './shared/metrics.js';

async function bootstrap() {
  // bufferLogs: os logs do boot esperam o pino assumir, para sair tudo em JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // credentials: a UI (outra origem) precisa mandar e receber o cookie do refresh.
  // Com credentials, a origem tem que ser exata; nada de '*'.
  // maxAge: sem ele o Chrome guarda o preflight só 5s, e o polling de 5s da UI
  // mandava um OPTIONS junto de quase todo GET.
  app.enableCors({
    origin: requiredEnv('CORS_ORIGIN'),
    credentials: true,
    exposedHeaders: ['x-correlation-id'],
    maxAge: 600,
  });
  app.use(httpMetrics);
  app.use(correlationMiddleware);
  app.use(cookieParser());
  // whitelist + forbidNonWhitelisted: campo fora do DTO vira 400 em vez de passar adiante.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  // Fecha o pool do Prisma no SIGTERM do `docker stop`.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
