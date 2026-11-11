import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
