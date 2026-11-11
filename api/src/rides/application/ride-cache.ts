import type { Ride } from '../domain/ride.js';

// Só leitura: quem escreve no cache é o worker, a partir dos eventos. Falha do
// cache devolve null, e a leitura cai no MySQL.
export abstract class RideCache {
  abstract get(id: string): Promise<Ride | null>;
}
