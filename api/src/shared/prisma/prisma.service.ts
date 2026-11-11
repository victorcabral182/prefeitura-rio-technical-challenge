import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';
import { requiredEnv } from '../env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaMariaDb(requiredEnv('DATABASE_URL')) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
