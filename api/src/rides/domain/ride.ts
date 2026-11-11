import type { Actor } from './actor.js';
import { InvalidStatusTransitionError, RideForbiddenError } from './errors.js';
import { NEXT_STATUS, type RideStatus } from './ride-status.js';

export type RideProps = {
  id: string;
  origin: string;
  destination: string;
  status: RideStatus;
  passengerId: string;
  driverId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

// As regras de perfil do enunciado moram aqui, não no controller, para valerem
// em qualquer entrada (HTTP hoje, fila ou CLI amanhã).
export class Ride {
  constructor(readonly props: RideProps) {}

  // Passageiro lê só as próprias. Motorista lê as abertas (precisa vê-las para
  // aceitar) e as que ele aceitou.
  canBeReadBy(actor: Actor): boolean {
    const { passengerId, driverId, status } = this.props;
    if (actor.type === 'passageiro') return passengerId === actor.id;
    return status === 'solicitada' || driverId === actor.id;
  }

  // Aceitar atribui o motorista; iniciar e finalizar só o motorista atribuído.
  // Devolve uma nova Ride com a versão incrementada.
  transitionTo(to: RideStatus, driverId: string, now: Date): Ride {
    const { status, driverId: assigned, version } = this.props;
    if (status !== 'solicitada' && assigned !== driverId) throw new RideForbiddenError();
    if (NEXT_STATUS[status] !== to) throw new InvalidStatusTransitionError(status, to);
    return new Ride({ ...this.props, status: to, driverId, version: version + 1, updatedAt: now });
  }
}
