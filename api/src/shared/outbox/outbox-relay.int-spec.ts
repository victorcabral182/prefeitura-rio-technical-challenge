import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, resetDatabase } from '../../../test/integration/database.js';
import { PrismaRideRepository } from '../../rides/infrastructure/prisma-ride.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboxRelay } from './outbox-relay.js';
import type { EventEnvelope, RabbitMqPublisher } from './rabbitmq-publisher.js';

const prisma = new PrismaService();

// O broker fica de fora: o que se testa aqui é o lado do banco (lock, marcação
// de publicado e retenção quando a publicação falha).
function fakePublisher(publish: (events: EventEnvelope[]) => Promise<void>) {
  return { publish: vi.fn(publish), close: vi.fn() } as unknown as RabbitMqPublisher & {
    publish: ReturnType<typeof vi.fn>;
  };
}

async function createRides(count: number) {
  const passenger = await createUser(prisma, 'passageiro', 'p@teste.local');
  const rides = new PrismaRideRepository(prisma);
  for (let i = 0; i < count; i++) {
    await rides.create({
      passengerId: passenger.id,
      origin: 'A',
      destination: 'B',
      idempotencyKey: `k${i}`,
      requestHash: 'h',
    });
  }
}

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe('OutboxRelay (MySQL)', () => {
  it('publica os pendentes no envelope do contrato e marca como publicados', async () => {
    await createRides(2);
    const publisher = fakePublisher(() => Promise.resolve());

    expect(await new OutboxRelay(prisma, publisher).publishPending()).toBe(2);
    const [batch] = publisher.publish.mock.calls[0] as [EventEnvelope[]];
    expect(batch[0]).toMatchObject({ type: 'corrida.criada', data: { status: 'solicitada' } });
    expect(batch[0].eventId).toEqual(expect.any(String));
    expect(await prisma.outboxEvento.count({ where: { publicadoEm: null } })).toBe(0);
  });

  it('broker fora: os eventos continuam pendentes para o próximo ciclo', async () => {
    await createRides(2);
    const publisher = fakePublisher(() => Promise.reject(new Error('broker fora')));

    await expect(new OutboxRelay(prisma, publisher).publishPending()).rejects.toThrow('broker fora');
    expect(await prisma.outboxEvento.count({ where: { publicadoEm: null } })).toBe(2);
  });

  it('dois relays ao mesmo tempo (duas réplicas): cada evento é publicado uma vez só', async () => {
    await createRides(5);
    const published: string[] = [];
    // Publicação lenta, para os dois relays estarem com a transação aberta juntos.
    const slow = (events: EventEnvelope[]) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          published.push(...events.map((e) => e.eventId));
          resolve();
        }, 200),
      );

    const counts = await Promise.all([
      new OutboxRelay(prisma, fakePublisher(slow)).publishPending(),
      new OutboxRelay(prisma, fakePublisher(slow)).publishPending(),
    ]);
    expect(counts[0] + counts[1]).toBe(5);
    expect(new Set(published).size).toBe(5);
    expect(published).toHaveLength(5);
  });
});
