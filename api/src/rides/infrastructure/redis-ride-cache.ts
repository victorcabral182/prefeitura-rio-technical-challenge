import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Counter } from 'prom-client';
import { requiredEnv } from '../../shared/env.js';
import { RideCache } from '../application/ride-cache.js';
import { fromSnapshot, type RideSnapshot } from '../application/ride-snapshot.js';
import type { Ride } from '../domain/ride.js';

// Chave gravada pelo worker; o formato do valor é o RideSnapshot dos eventos.
export const rideCacheKey = (id: string) => `corrida:${id}`;

// Taxa de acerto do GET /corridas/:id. Muito miss com tráfego normal = worker
// parado ou atrasado (só ele escreve no cache); erro = Redis fora.
const lookups = new Counter({
  name: 'cache_lookups_total',
  help: 'Leituras do cache de corridas por resultado',
  labelNames: ['result'] as const,
});

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
      lookups.inc({ result: value ? 'hit' : 'miss' });
      return value ? fromSnapshot(JSON.parse(value) as RideSnapshot) : null;
    } catch (error) {
      lookups.inc({ result: 'erro' });
      this.logger.warn(`Cache ignorado para a corrida ${id}: ${(error as Error).message}`);
      return null;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
