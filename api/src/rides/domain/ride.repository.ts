import type { Actor } from './actor.js';
import type { Ride } from './ride.js';

export type NewRide = {
  passengerId: string;
  origin: string;
  destination: string;
  idempotencyKey: string;
  requestHash: string;
};

export type IdempotentRide = { ride: Ride; requestHash: string };

// Toda escrita grava também o evento no outbox, na mesma transação.
export abstract class RideRepository {
  abstract findById(id: string): Promise<Ride | null>;
  abstract listVisibleTo(actor: Actor, limit: number): Promise<Ride[]>;
  abstract findByIdempotencyKey(passengerId: string, key: string): Promise<IdempotentRide | null>;
  // null: outra requisição criou a corrida com a mesma chave ao mesmo tempo.
  abstract create(data: NewRide): Promise<Ride | null>;
  // Grava a transição se a corrida ainda estiver na versão lida; senão RideConflictError.
  abstract saveTransition(ride: Ride, previousVersion: number): Promise<void>;
  // Igual à saveTransition, serializando por motorista: DriverBusyError se ele já
  // tiver corrida em aberto.
  abstract saveAcceptance(ride: Ride, previousVersion: number): Promise<void>;
}
