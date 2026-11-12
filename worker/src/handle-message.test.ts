import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleMessage, type Stores } from './handle-message.ts';
import type { RideEvent } from './ride-event.ts';

const event: RideEvent = {
  eventId: 'evt-1',
  type: 'corrida.criada',
  occurredAt: '2026-11-12T12:00:00.000Z',
  data: {
    id: 'c-1',
    origem: 'Centro',
    destino: 'Barra',
    status: 'solicitada',
    passageiroId: 'p-1',
    motoristaId: null,
    versao: 1,
    criadaEm: '2026-11-12T12:00:00.000Z',
    atualizadaEm: '2026-11-12T12:00:00.000Z',
  },
};
const body = (value: unknown) => Buffer.from(JSON.stringify(value));

function fakeStores(overrides: Partial<Stores> = {}) {
  const calls: string[] = [];
  const stores: Stores = {
    saveHistory: async () => (calls.push('history'), true),
    saveCache: async () => (calls.push('cache'), true),
    ...overrides,
  };
  return { stores, calls };
}

describe('handleMessage', () => {
  it('evento válido: grava histórico e cache e dá ack', async () => {
    const { stores, calls } = fakeStores();
    assert.equal(await handleMessage(body(event), 'req-1', stores), 'ack');
    assert.deepEqual(calls, ['history', 'cache']);
  });

  it('reentrega com histórico já gravado: ainda grava o cache (pode ser o que faltou)', async () => {
    const { stores, calls } = fakeStores({ saveHistory: async () => false });
    assert.equal(await handleMessage(body(event), undefined, stores), 'ack');
    assert.deepEqual(calls, ['cache']);
  });

  it('JSON quebrado ou fora do contrato: DLQ sem tentar gravar', async () => {
    const { stores, calls } = fakeStores();
    assert.equal(await handleMessage(Buffer.from('{nao é json'), undefined, stores), 'dead-letter');
    assert.equal(await handleMessage(body({ ...event, data: { ...event.data, versao: '1' } }), undefined, stores), 'dead-letter');
    assert.equal(await handleMessage(body({ ...event, occurredAt: 'ontem' }), undefined, stores), 'dead-letter');
    assert.deepEqual(calls, []);
  });

  it('Mongo ou Redis fora: devolve para a fila', async () => {
    const { stores } = fakeStores({ saveCache: () => Promise.reject(new Error('Redis fora')) });
    assert.equal(await handleMessage(body(event), undefined, stores), 'retry');
  });
});
