import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { requiredEnv } from './log.ts';
import type { RideEvent } from './ride-event.ts';
import { createStores, History, rideCacheKey } from './stores.ts';

// Mesmos servidores do dev, isolados: banco corridas_test no Mongo e db 15 no
// Redis (o dev usa o db 0).
const redis = new Redis(requiredEnv('REDIS_URL'), { db: 15 });
const stores = createStores(redis);

const event = (eventId: string, versao: number, status: string): RideEvent => ({
  eventId,
  type: 'corrida.status_alterado',
  occurredAt: '2026-11-12T12:00:00.000Z',
  data: {
    id: 'c-1',
    origem: 'Centro',
    destino: 'Barra',
    status,
    passageiroId: 'p-1',
    motoristaId: 'm-1',
    versao,
    criadaEm: '2026-11-12T12:00:00.000Z',
    atualizadaEm: '2026-11-12T12:00:00.000Z',
  },
});

before(async () => {
  await mongoose.connect(requiredEnv('MONGO_URL'), { dbName: 'corridas_test' });
  await History.init(); // garante o índice antes dos testes
});
beforeEach(async () => {
  await History.deleteMany({});
  await redis.flushdb();
});
after(async () => {
  await mongoose.disconnect();
  redis.disconnect();
});

describe('stores (Mongo e Redis reais)', () => {
  it('mesmo eventId duas vezes: um documento só no histórico', async () => {
    assert.equal(await stores.saveHistory(event('evt-1', 2, 'aceita'), 'req-1'), true);
    assert.equal(await stores.saveHistory(event('evt-1', 2, 'aceita'), 'req-1'), false);
    assert.equal(await History.countDocuments(), 1);
    const doc = await History.findById('evt-1').lean();
    assert.equal(doc?.correlationId, 'req-1');
  });

  it('cache: versão antiga chegando depois não sobrescreve a mais nova', async () => {
    assert.equal(await stores.saveCache(event('evt-3', 3, 'em_andamento').data), true);
    assert.equal(await stores.saveCache(event('evt-2', 2, 'aceita').data), false);
    assert.equal(await stores.saveCache(event('evt-3', 3, 'em_andamento').data), false);
    const cached = JSON.parse((await redis.get(rideCacheKey('c-1'))) ?? '{}');
    assert.equal(cached.status, 'em_andamento');
  });

  it('cache: versão nova substitui', async () => {
    await stores.saveCache(event('evt-2', 2, 'aceita').data);
    assert.equal(await stores.saveCache(event('evt-3', 3, 'em_andamento').data), true);
    assert.equal(JSON.parse((await redis.get(rideCacheKey('c-1'))) ?? '{}').versao, 3);
  });
});
