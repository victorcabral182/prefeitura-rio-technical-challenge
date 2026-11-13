import { describe, expect, it } from 'vitest';
import { InvalidStatusTransitionError, RideForbiddenError } from './errors.js';
import { Ride, type RideProps } from './ride.js';

const now = new Date('2026-11-11T12:00:00Z');
const ride = (overrides: Partial<RideProps> = {}) =>
  new Ride({
    id: 'r1',
    origin: 'Centro',
    destination: 'Barra',
    status: 'solicitada',
    passengerId: 'p1',
    driverId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

describe('Ride', () => {
  it('percorre o ciclo solicitada → aceita → em_andamento → finalizada, incrementando a versão', () => {
    const accepted = ride().transitionTo('aceita', 'm1', now);
    expect(accepted.props).toMatchObject({ status: 'aceita', driverId: 'm1', version: 2 });
    const finished = accepted.transitionTo('em_andamento', 'm1', now).transitionTo('finalizada', 'm1', now);
    expect(finished.props).toMatchObject({ status: 'finalizada', version: 4 });
  });

  it('recusa pular ou voltar status', () => {
    expect(() => ride().transitionTo('finalizada', 'm1', now)).toThrow(InvalidStatusTransitionError);
    const done = ride({ status: 'finalizada', driverId: 'm1' });
    expect(() => done.transitionTo('aceita', 'm1', now)).toThrow(InvalidStatusTransitionError);
  });

  it('só o motorista atribuído inicia ou finaliza', () => {
    const accepted = ride({ status: 'aceita', driverId: 'm1' });
    expect(() => accepted.transitionTo('em_andamento', 'm2', now)).toThrow(RideForbiddenError);
  });

  it('passageiro lê só as próprias; motorista lê as abertas e as dele', () => {
    expect(ride().canBeReadBy({ id: 'p1', type: 'passageiro' })).toBe(true);
    expect(ride().canBeReadBy({ id: 'p2', type: 'passageiro' })).toBe(false);
    expect(ride().canBeReadBy({ id: 'm9', type: 'motorista' })).toBe(true);
    const taken = ride({ status: 'aceita', driverId: 'm1' });
    expect(taken.canBeReadBy({ id: 'm1', type: 'motorista' })).toBe(true);
    expect(taken.canBeReadBy({ id: 'm9', type: 'motorista' })).toBe(false);
  });
});
