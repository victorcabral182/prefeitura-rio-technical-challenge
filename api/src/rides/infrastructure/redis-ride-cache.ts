import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { requiredEnv } from '../../shared/env.js';
import { RideCache } from '../application/ride-cache.js';
import { fromSnapshot, type RideSnapshot } from '../application/ride-snapshot.js';
import type { Ride } from '../domain/ride.js';

// Chave gravada pelo worker; o formato do valor é o RideSnapshot dos eventos.
export const rideCacheKey = (id: string) => `corrida:${id}`;

@Injectable()
export class RedisRideCache extends RideCache implements OnModuleDestroy {
  private readonly logger = new Logger(RedisRideCache.name);
  // Sem fila offline: com o Redis fora, o comando falha na hora e a leitura cai
  // no MySQL, em vez de a requisição esperar a reconexão.
  private readonly redis = new Redis(requiredEnv('REDIS_URL'), { enableOfflineQueue: false, maxRetriesPerRequest: 1 });

  constructor() {
    super();
    this.redis.on('error', (error: Error) => this.logger.warn(`Redis indisponível: ${error.message}`));
  }

  async get(id: string): Promise<Ride | null> {
    try {
      const value = await this.redis.get(rideCacheKey(id));
      return value ? fromSnapshot(JSON.parse(value) as RideSnapshot) : null;
    } catch (error) {
      this.logger.warn(`Cache ignorado para a corrida ${id}: ${(error as Error).message}`);
      return null;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
