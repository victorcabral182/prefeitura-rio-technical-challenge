import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ChangeRideStatusUseCase } from './application/change-ride-status.use-case.js';
import { GetRideUseCase } from './application/get-ride.use-case.js';
import { ListRidesUseCase } from './application/list-rides.use-case.js';
import { RequestRideUseCase } from './application/request-ride.use-case.js';
import { RideCache } from './application/ride-cache.js';
import { RideRepository } from './domain/ride.repository.js';
import { PrismaRideRepository } from './infrastructure/prisma-ride.repository.js';
import { RedisRideCache } from './infrastructure/redis-ride-cache.js';
import { RidesController } from './presentation/rides.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [RidesController],
  providers: [
    RequestRideUseCase,
    ChangeRideStatusUseCase,
    GetRideUseCase,
    ListRidesUseCase,
    { provide: RideRepository, useClass: PrismaRideRepository },
    { provide: RideCache, useClass: RedisRideCache },
  ],
})
export class RidesModule {}
