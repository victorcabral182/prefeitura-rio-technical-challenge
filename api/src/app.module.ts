import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { RidesModule } from './rides/rides.module.js';
import { OutboxModule } from './shared/outbox/outbox.module.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, IdentityModule, RidesModule, OutboxModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
