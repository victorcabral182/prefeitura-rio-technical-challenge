import { Injectable } from '@nestjs/common';
import type { Actor } from '../domain/actor.js';
import { RideForbiddenError, RideNotFoundError } from '../domain/errors.js';
import type { Ride } from '../domain/ride.js';
import { RideRepository } from '../domain/ride.repository.js';
import type { RideStatus } from '../domain/ride-status.js';

@Injectable()
export class ChangeRideStatusUseCase {
  constructor(private readonly rides: RideRepository) {}

  async execute(actor: Actor, rideId: string, status: RideStatus, now = new Date()): Promise<Ride> {
    if (actor.type !== 'motorista') throw new RideForbiddenError('Só motoristas alteram o status');
    const ride = await this.rides.findById(rideId);
    if (!ride) throw new RideNotFoundError();

    const next = ride.transitionTo(status, actor.id, now);
    if (status === 'aceita') await this.rides.saveAcceptance(next, ride.props.version);
    else await this.rides.saveTransition(next, ride.props.version);
    return next;
  }
}
