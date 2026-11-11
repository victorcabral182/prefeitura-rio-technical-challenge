import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../identity/presentation/jwt-auth.guard.js';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard.js';
import { ChangeRideStatusUseCase } from '../application/change-ride-status.use-case.js';
import { GetRideUseCase } from '../application/get-ride.use-case.js';
import { ListRidesUseCase } from '../application/list-rides.use-case.js';
import { RequestRideUseCase } from '../application/request-ride.use-case.js';
import { type RideSnapshot, toSnapshot } from '../application/ride-snapshot.js';
import { ChangeStatusDto, RequestRideDto } from './ride.dto.js';
import { RidesErrorFilter } from './rides-error.filter.js';

@Controller('corridas')
@UseGuards(JwtAuthGuard)
@UseFilters(RidesErrorFilter)
export class RidesController {
  constructor(
    private readonly requestRide: RequestRideUseCase,
    private readonly changeStatus: ChangeRideStatusUseCase,
    private readonly getRide: GetRideUseCase,
    private readonly listRides: ListRidesUseCase,
  ) {}

  // Reenvio com a mesma chave responde 201 com a mesma corrida: para o cliente
  // é como se a primeira resposta tivesse chegado.
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: RequestRideDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<RideSnapshot> {
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new BadRequestException('Cabeçalho Idempotency-Key obrigatório (até 255 caracteres)');
    }
    const ride = await this.requestRide.execute(
      req.user,
      { origin: body.origem, destination: body.destino },
      idempotencyKey,
    );
    return toSnapshot(ride);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<RideSnapshot[]> {
    return (await this.listRides.execute(req.user)).map(toSnapshot);
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<RideSnapshot> {
    return toSnapshot(await this.getRide.execute(req.user, id));
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ChangeStatusDto,
  ): Promise<RideSnapshot> {
    return toSnapshot(await this.changeStatus.execute(req.user, id, body.status));
  }
}
