import { Injectable } from '@nestjs/common';
import { type Corrida, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { correlationId } from '../../shared/correlation.js';
import { toSnapshot } from '../application/ride-snapshot.js';
import type { Actor } from '../domain/actor.js';
import { DriverBusyError, RideConflictError } from '../domain/errors.js';
import { Ride } from '../domain/ride.js';
import { type IdempotentRide, type NewRide, RideRepository } from '../domain/ride.repository.js';
import { ACTIVE_STATUSES } from '../domain/ride-status.js';
import { RIDE_CREATED, RIDE_STATUS_CHANGED } from './ride-events.js';

type Tx = Prisma.TransactionClient;

function toDomain(row: Corrida): Ride {
  return new Ride({
    id: row.id,
    origin: row.origem,
    destination: row.destino,
    status: row.status,
    passengerId: row.passageiroId,
    driverId: row.motoristaId,
    version: row.versao,
    createdAt: row.criadaEm,
    updatedAt: row.atualizadaEm,
  });
}

// O evento vai no outbox dentro da mesma transação da escrita: ou os dois
// gravam, ou nenhum.
function recordEvent(tx: Tx, type: string, ride: Ride) {
  const id = correlationId();
  return tx.outboxEvento.create({
    data: { tipo: type, payload: toSnapshot(ride), headers: id ? { correlation_id: id } : undefined },
  });
}

@Injectable()
export class PrismaRideRepository extends RideRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Ride | null> {
    const row = await this.prisma.corrida.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  // Mesma regra de Ride.canBeReadBy, em SQL para não trazer tudo e filtrar em memória.
  async listVisibleTo(actor: Actor, limit: number): Promise<Ride[]> {
    const where: Prisma.CorridaWhereInput =
      actor.type === 'passageiro'
        ? { passageiroId: actor.id }
        : { OR: [{ status: 'solicitada' }, { motoristaId: actor.id }] };
    const rows = await this.prisma.corrida.findMany({ where, orderBy: { criadaEm: 'desc' }, take: limit });
    return rows.map(toDomain);
  }

  async findByIdempotencyKey(passengerId: string, key: string): Promise<IdempotentRide | null> {
    const row = await this.prisma.corrida.findUnique({
      where: { passageiroId_chaveIdempotencia: { passageiroId: passengerId, chaveIdempotencia: key } },
    });
    return row && { ride: toDomain(row), requestHash: row.hashIdempotencia };
  }

  async create(data: NewRide): Promise<Ride | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.corrida.create({
          data: {
            origem: data.origin,
            destino: data.destination,
            passageiroId: data.passengerId,
            chaveIdempotencia: data.idempotencyKey,
            hashIdempotencia: data.requestHash,
          },
        });
        const ride = toDomain(row);
        await recordEvent(tx, RIDE_CREATED, ride);
        return ride;
      });
    } catch (error) {
      // P2002: violou a UNIQUE (passageiro_id, chave_idempotencia).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  async saveTransition(ride: Ride, previousVersion: number): Promise<void> {
    await this.prisma.$transaction((tx) => this.applyTransition(tx, ride, previousVersion));
  }

  // FOR UPDATE na linha do motorista: dois aceites dele ao mesmo tempo passam um
  // de cada vez, e o segundo já enxerga a corrida aceita pelo primeiro. READ
  // COMMITTED para a contagem ler o que foi commitado depois do lock, e não o
  // snapshot do início da transação (padrão REPEATABLE READ do InnoDB).
  async saveAcceptance(ride: Ride, previousVersion: number): Promise<void> {
    const driverId = ride.props.driverId!;
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${driverId} FOR UPDATE`;
        const active = await tx.corrida.count({ where: { motoristaId: driverId, status: { in: ACTIVE_STATUSES } } });
        if (active > 0) throw new DriverBusyError();
        await this.applyTransition(tx, ride, previousVersion);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  // UPDATE condicional na versão (lock otimista): se outra requisição mudou a
  // corrida depois da leitura, nenhuma linha é afetada.
  private async applyTransition(tx: Tx, ride: Ride, previousVersion: number): Promise<void> {
    const { id, status, driverId, version, updatedAt } = ride.props;
    const { count } = await tx.corrida.updateMany({
      where: { id, versao: previousVersion },
      data: { status, motoristaId: driverId, versao: version, atualizadaEm: updatedAt },
    });
    if (count !== 1) throw new RideConflictError();
    await recordEvent(tx, RIDE_STATUS_CHANGED, ride);
  }
}
