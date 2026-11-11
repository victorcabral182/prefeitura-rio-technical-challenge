import { Injectable } from '@nestjs/common';
import type { Actor } from '../domain/actor.js';
import { RideForbiddenError, RideNotFoundError } from '../domain/errors.js';
import type { Ride } from '../domain/ride.js';
import { RideRepository } from '../domain/ride.repository.js';
import { RideCache } from './ride-cache.js';

@Injectable()
export class GetRideUseCase {
  constructor(
    private readonly cache: RideCache,
    private readonly rides: RideRepository,
  ) {}

  // Miss (corrida recém-criada, worker atrasado ou Redis fora) lê o MySQL e não
  // grava no cache: o worker é o único escritor, então não há corrida de escrita.
  async execute(actor: Actor, rideId: string): Promise<Ride> {
    const ride = (await this.cache.get(rideId)) ?? (await this.rides.findById(rideId));
    if (!ride) throw new RideNotFoundError();
    if (!ride.canBeReadBy(actor)) throw new RideForbiddenError();
    return ride;
  }
}
