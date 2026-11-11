import type { RideStatus } from './ride-status.js';

export abstract class RidesError extends Error {}

export class RideNotFoundError extends RidesError {
  constructor() {
    super('Corrida não encontrada');
  }
}

export class RideForbiddenError extends RidesError {
  constructor(message = 'Sem permissão para esta corrida') {
    super(message);
  }
}

export class InvalidStatusTransitionError extends RidesError {
  constructor(from: RideStatus, to: RideStatus) {
    super(`Corrida ${from} não pode passar para ${to}`);
  }
}

export class DriverBusyError extends RidesError {
  constructor() {
    super('Motorista já tem uma corrida em aberto');
  }
}

// Outra requisição mudou a corrida entre a leitura e a escrita.
export class RideConflictError extends RidesError {
  constructor() {
    super('A corrida foi alterada por outra requisição; tente de novo');
  }
}

export class IdempotencyKeyReuseError extends RidesError {
  constructor() {
    super('Idempotency-Key já usada com outra requisição');
  }
}
