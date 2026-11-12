import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { RidesModule } from './rides/rides.module.js';
import { loggerOptions } from './shared/logging.js';
import { MetricsController } from './shared/metrics.js';
import { OutboxModule } from './shared/outbox/outbox.module.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';

@Module({
  imports: [LoggerModule.forRoot(loggerOptions), PrismaModule, IdentityModule, RidesModule, OutboxModule],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
