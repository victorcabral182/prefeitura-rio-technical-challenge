import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMqPublisher } from './rabbitmq-publisher.js';

const INTERVAL_MS = 1000;
const BATCH_SIZE = 100;

// Lê o outbox a cada segundo e publica o que estiver pendente.
// Entrega at-least-once: se a API cair depois do confirm e antes do commit, o
// lote é publicado de novo no próximo ciclo; o worker deduplica pelo eventId.
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMqPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
    await this.publisher.close();
  }

  // Publica um lote. SKIP LOCKED: com várias réplicas da API, cada uma pega
  // linhas diferentes em vez de esperar ou publicar o mesmo evento.
  async publishPending(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM outbox_eventos WHERE publicado_em IS NULL
        ORDER BY id LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED`;
      if (locked.length === 0) return 0;
      const ids = locked.map((row) => row.id);
      const events = await tx.outboxEvento.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
      await this.publisher.publish(
        events.map((e) => ({ eventId: e.id, type: e.tipo, occurredAt: e.criadoEm.toISOString(), data: e.payload })),
      );
      await tx.outboxEvento.updateMany({ where: { id: { in: ids } }, data: { publicadoEm: new Date() } });
      return events.length;
    });
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.running = this.drain().finally(() => {
        if (!this.stopped) this.schedule();
      });
    }, INTERVAL_MS);
  }

  // Lote cheio indica fila acumulada: continua sem esperar o próximo ciclo.
  private async drain(): Promise<void> {
    try {
      while (!this.stopped && (await this.publishPending()) === BATCH_SIZE);
    } catch (error) {
      this.logger.warn(`Outbox não publicado, nova tentativa em ${INTERVAL_MS}ms: ${(error as Error).message}`);
    }
  }
}
