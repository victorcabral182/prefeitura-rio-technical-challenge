import { Ride } from '../domain/ride.js';
import type { RideStatus } from '../domain/ride-status.js';

// Linguagem publicada da corrida: o mesmo formato na resposta HTTP, no payload
// dos eventos e no cache do Redis (que o worker grava a partir dos eventos).
// Chaves em português, como o restante do contrato externo.
export type RideSnapshot = {
  id: string;
  origem: string;
  destino: string;
  status: RideStatus;
  passageiroId: string;
  motoristaId: string | null;
  versao: number;
  criadaEm: string;
  atualizadaEm: string;
};

export function toSnapshot({ props: p }: Ride): RideSnapshot {
  return {
    id: p.id,
    origem: p.origin,
    destino: p.destination,
    status: p.status,
    passageiroId: p.passengerId,
    motoristaId: p.driverId,
    versao: p.version,
    criadaEm: p.createdAt.toISOString(),
    atualizadaEm: p.updatedAt.toISOString(),
  };
}

export function fromSnapshot(s: RideSnapshot): Ride {
  return new Ride({
    id: s.id,
    origin: s.origem,
    destination: s.destino,
    status: s.status,
    passengerId: s.passageiroId,
    driverId: s.motoristaId,
    version: s.versao,
    createdAt: new Date(s.criadaEm),
    updatedAt: new Date(s.atualizadaEm),
  });
}
