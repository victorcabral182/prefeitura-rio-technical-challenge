import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase } from '../../../test/integration/database.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { Actor } from '../domain/actor.js';
import { DriverBusyError, RideConflictError } from '../domain/errors.js';
import type { Ride } from '../domain/ride.js';
import { PrismaRideRepository } from './prisma-ride.repository.js';

const prisma = new PrismaService();
const rides = new PrismaRideRepository(prisma);
let passenger: Actor;
let driver: Actor;
let otherDriver: Actor;

const newRide = (key: string, passengerId = passenger.id) => ({
  passengerId,
  origin: 'Centro',
  destination: 'Barra',
  idempotencyKey: key,
  requestHash: 'h',
});

async function createRide(key: string): Promise<Ride> {
  return (await rides.create(newRide(key)))!;
}

const accept = (ride: Ride, actor: Actor) =>
  rides.saveAcceptance(ride.transitionTo('aceita', actor.id, new Date()), ride.props.version);

beforeEach(async () => {
  await resetDatabase(prisma);
  passenger = { id: (await createUser(prisma, 'passageiro', 'p@teste.local')).id, type: 'passageiro' };
  driver = { id: (await createUser(prisma, 'motorista', 'm1@teste.local')).id, type: 'motorista' };
  otherDriver = { id: (await createUser(prisma, 'motorista', 'm2@teste.local')).id, type: 'motorista' };
});

afterAll(() => prisma.$disconnect());

describe('PrismaRideRepository (MySQL)', () => {
  it('grava a corrida e o evento corrida.criada na mesma transação', async () => {
    const ride = await createRide('k1');
    const events = await prisma.outboxEvento.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tipo: 'corrida.criada', publicadoEm: null });
    expect(events[0].payload).toMatchObject({ id: ride.props.id, status: 'solicitada', versao: 1 });
  });

  it('10 creates simultâneos com a mesma chave: uma corrida, um evento, os outros recebem null', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => rides.create(newRide('mesma'))));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.corrida.count()).toBe(1);
    expect(await prisma.outboxEvento.count()).toBe(1);
  });

  it('a mesma chave em passageiros diferentes não conflita', async () => {
    const other = await createUser(prisma, 'passageiro', 'p2@teste.local');
    await rides.create(newRide('k1'));
    expect(await rides.create(newRide('k1', other.id))).not.toBeNull();
  });

  it('aceites simultâneos do mesmo motorista em duas corridas: só um passa', async () => {
    const [a, b] = [await createRide('a'), await createRide('b')];
    const results = await Promise.allSettled([accept(a, driver), accept(b, driver)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(DriverBusyError);
    expect(await prisma.corrida.count({ where: { motoristaId: driver.id, status: 'aceita' } })).toBe(1);
  });

  it('dois motoristas aceitando a mesma corrida ao mesmo tempo: um ganha, o outro recebe conflito', async () => {
    const ride = await createRide('k1');
    const results = await Promise.allSettled([accept(ride, driver), accept(ride, otherDriver)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')?.reason).toBeInstanceOf(RideConflictError);
    const stored = await prisma.corrida.findUniqueOrThrow({ where: { id: ride.props.id } });
    expect(stored.versao).toBe(2);
  });

  it('motorista volta a aceitar depois de finalizar a corrida em aberto', async () => {
    const first = await createRide('a');
    await accept(first, driver);
    const started = (await rides.findById(first.props.id))!.transitionTo('em_andamento', driver.id, new Date());
    await rides.saveTransition(started, 2);
    await rides.saveTransition(started.transitionTo('finalizada', driver.id, new Date()), 3);

    await expect(accept(await createRide('b'), driver)).resolves.toBeUndefined();
  });

  it('transição com versão velha não grava nada, nem o evento', async () => {
    const ride = await createRide('k1');
    await accept(ride, driver);
    const stale = ride.transitionTo('aceita', otherDriver.id, new Date());

    await expect(rides.saveTransition(stale, 1)).rejects.toBeInstanceOf(RideConflictError);
    const stored = await prisma.corrida.findUniqueOrThrow({ where: { id: ride.props.id } });
    expect(stored.motoristaId).toBe(driver.id);
    expect(await prisma.outboxEvento.count({ where: { tipo: 'corrida.status_alterado' } })).toBe(1);
  });

  it('listagem: passageiro vê as próprias; motorista vê as abertas e as dele', async () => {
    const other = await createUser(prisma, 'passageiro', 'p2@teste.local');
    const mine = await createRide('a');
    await rides.create(newRide('b', other.id));
    const taken = await createRide('c');
    await accept(taken, otherDriver);

    const forPassenger = await rides.listVisibleTo(passenger, 50);
    expect(forPassenger.map((r) => r.props.id).sort()).toEqual([mine.props.id, taken.props.id].sort());
    const forDriver = await rides.listVisibleTo(driver, 50);
    expect(forDriver.every((r) => r.props.status === 'solicitada')).toBe(true);
    expect(forDriver).toHaveLength(2);
  });
});
