import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Actor } from '../domain/actor.js';
import { IdempotencyKeyReuseError, RideForbiddenError } from '../domain/errors.js';
import type { Ride } from '../domain/ride.js';
import { type IdempotentRide, RideRepository } from '../domain/ride.repository.js';

export type RideRequest = { origin: string; destination: string };

// Idempotência em duas camadas: a aplicação procura a chave antes de criar, e a
// UNIQUE (passageiro_id, chave_idempotencia) resolve dois POSTs simultâneos que
// passem juntos pela procura.
@Injectable()
export class RequestRideUseCase {
  constructor(private readonly rides: RideRepository) {}

  async execute(actor: Actor, request: RideRequest, idempotencyKey: string): Promise<Ride> {
    if (actor.type !== 'passageiro') throw new RideForbiddenError('Só passageiros solicitam corridas');
    const requestHash = createHash('sha256').update(JSON.stringify([request.origin, request.destination])).digest('hex');

    const existing = await this.rides.findByIdempotencyKey(actor.id, idempotencyKey);
    if (existing) return replay(existing, requestHash);

    const created = await this.rides.create({ passengerId: actor.id, ...request, idempotencyKey, requestHash });
    if (created) return created;
    // Perdeu a corrida para a requisição concorrente: a corrida dela é a resposta.
    const winner = await this.rides.findByIdempotencyKey(actor.id, idempotencyKey);
    return replay(winner!, requestHash);
  }
}

// Mesma chave e mesmo corpo: é reenvio, devolve a corrida original. Mesma chave
// com outro corpo: o cliente reaproveitou a chave por engano.
function replay({ ride, requestHash }: IdempotentRide, incomingHash: string): Ride {
  if (requestHash !== incomingHash) throw new IdempotencyKeyReuseError();
  return ride;
}
