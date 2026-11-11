import { describe, expect, it } from 'vitest';
import type { Actor } from '../domain/actor.js';
import { IdempotencyKeyReuseError, RideForbiddenError } from '../domain/errors.js';
import { Ride } from '../domain/ride.js';
import { type IdempotentRide, type NewRide, RideRepository } from '../domain/ride.repository.js';
import { ChangeRideStatusUseCase } from './change-ride-status.use-case.js';
import { GetRideUseCase } from './get-ride.use-case.js';
import { RequestRideUseCase } from './request-ride.use-case.js';
import { RideCache } from './ride-cache.js';

const passenger: Actor = { id: 'p1', type: 'passageiro' };
const driver: Actor = { id: 'm1', type: 'motorista' };

// Em memória, com o mesmo comportamento da UNIQUE (passageiro, chave): `raceOnce`
// simula outra requisição criando a corrida entre a procura e o insert.
class FakeRides extends RideRepository {
  rows: { ride: Ride; key: string; requestHash: string }[] = [];
  raceOnce = false;

  findById = (id: string) => Promise.resolve(this.rows.find((r) => r.ride.props.id === id)?.ride ?? null);
  listVisibleTo = () => Promise.resolve(this.rows.map((r) => r.ride));
  findByIdempotencyKey(passengerId: string, key: string): Promise<IdempotentRide | null> {
    const row = this.rows.find((r) => r.ride.props.passengerId === passengerId && r.key === key);
    return Promise.resolve(row ? { ride: row.ride, requestHash: row.requestHash } : null);
  }
  create(data: NewRide): Promise<Ride | null> {
    const insert = () => {
      const ride = new Ride({
        id: `r${this.rows.length + 1}`,
        origin: data.origin,
        destination: data.destination,
        status: 'solicitada',
        passengerId: data.passengerId,
        driverId: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.rows.push({ ride, key: data.idempotencyKey, requestHash: data.requestHash });
      return ride;
    };
    if (this.raceOnce) {
      this.raceOnce = false;
      insert();
      return Promise.resolve(null);
    }
    return Promise.resolve(insert());
  }
  saveTransition = () => Promise.resolve();
  saveAcceptance = () => Promise.resolve();
}

class FakeCache extends RideCache {
  value: Ride | null = null;
  get = () => Promise.resolve(this.value);
}

const trip = { origin: 'Centro', destination: 'Barra' };

describe('solicitar corrida', () => {
  it('reenvio com a mesma chave devolve a mesma corrida sem criar outra', async () => {
    const rides = new FakeRides();
    const useCase = new RequestRideUseCase(rides);
    const first = await useCase.execute(passenger, trip, 'k1');
    const again = await useCase.execute(passenger, trip, 'k1');
    expect(again.props.id).toBe(first.props.id);
    expect(rides.rows).toHaveLength(1);
  });

  it('mesma chave com outro corpo é recusada', async () => {
    const useCase = new RequestRideUseCase(new FakeRides());
    await useCase.execute(passenger, trip, 'k1');
    await expect(useCase.execute(passenger, { ...trip, destination: 'Lapa' }, 'k1')).rejects.toThrow(
      IdempotencyKeyReuseError,
    );
  });

  it('perdendo a disputa para um POST simultâneo, devolve a corrida do vencedor', async () => {
    const rides = new FakeRides();
    rides.raceOnce = true;
    const ride = await new RequestRideUseCase(rides).execute(passenger, trip, 'k1');
    expect(ride.props.id).toBe('r1');
    expect(rides.rows).toHaveLength(1);
  });

  it('motorista não solicita corrida (403)', async () => {
    await expect(new RequestRideUseCase(new FakeRides()).execute(driver, trip, 'k1')).rejects.toThrow(
      RideForbiddenError,
    );
  });
});

describe('alterar status', () => {
  it('passageiro não altera status (403)', async () => {
    const rides = new FakeRides();
    const ride = await new RequestRideUseCase(rides).execute(passenger, trip, 'k1');
    await expect(new ChangeRideStatusUseCase(rides).execute(passenger, ride.props.id, 'aceita')).rejects.toThrow(
      RideForbiddenError,
    );
  });
});

describe('ler corrida', () => {
  it('usa o cache quando há hit e cai no repositório no miss', async () => {
    const rides = new FakeRides();
    const cache = new FakeCache();
    const stored = await new RequestRideUseCase(rides).execute(passenger, trip, 'k1');
    const useCase = new GetRideUseCase(cache, rides);

    expect((await useCase.execute(passenger, stored.props.id)).props.destination).toBe('Barra');
    cache.value = new Ride({ ...stored.props, destination: 'do cache' });
    expect((await useCase.execute(passenger, stored.props.id)).props.destination).toBe('do cache');
  });

  it('outro passageiro recebe 403 mesmo com a corrida no cache', async () => {
    const rides = new FakeRides();
    const cache = new FakeCache();
    cache.value = await new RequestRideUseCase(rides).execute(passenger, trip, 'k1');
    await expect(new GetRideUseCase(cache, rides).execute({ id: 'p2', type: 'passageiro' }, 'r1')).rejects.toThrow(
      RideForbiddenError,
    );
  });
});
