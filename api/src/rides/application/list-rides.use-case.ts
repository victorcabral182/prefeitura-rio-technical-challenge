import { Injectable } from '@nestjs/common';
import type { Actor } from '../domain/actor.js';
import type { Ride } from '../domain/ride.js';
import { RideRepository } from '../domain/ride.repository.js';

// ponytail: limite fixo, sem paginação; cursor pelo id (UUID v7) quando a lista crescer.
export const LIST_LIMIT = 50;

@Injectable()
export class ListRidesUseCase {
  constructor(private readonly rides: RideRepository) {}

  execute(actor: Actor): Promise<Ride[]> {
    return this.rides.listVisibleTo(actor, LIST_LIMIT);
  }
}
