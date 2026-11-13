import { Injectable, Logger } from '@nestjs/common';
import { context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';
import { type ChannelModel, type ConfirmChannel, connect } from 'amqplib';
import { requiredEnv } from '../env.js';

// Exchange criada pelo próprio broker no boot (rabbitmq/definitions.json).
const EXCHANGE = 'corridas';

export type EventEnvelope = { eventId: string; type: string; occurredAt: string; data: unknown };
// `headers` vai nos headers AMQP, fora do corpo (correlation_id, traceparent).
export type OutboundEvent = EventEnvelope & { headers?: Record<string, string> };

// Conexão preguiçosa: abre no primeiro publish e, se cair, é descartada e
// reaberta no próximo. O relay tenta de novo a cada ciclo, então isso basta
// como reconexão.
@Injectable()
export class RabbitMqPublisher {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  // Publisher confirms: só retorna depois que o broker confirmou o recebimento
  // de todas as mensagens. Até lá o outbox continua marcando os eventos como pendentes.
  async publish(events: OutboundEvent[]): Promise<void> {
    const channel = await this.getChannel();
    try {
      for (const { headers, ...envelope } of events) {
        // Publica dentro do contexto da requisição que gerou o evento: o span de
        // publish entra no mesmo trace, e a instrumentação do amqplib troca o
        // traceparent dos headers pelo desse span.
        const origin = propagation.extract(ROOT_CONTEXT, headers ?? {});
        context.with(origin, () =>
          channel.publish(EXCHANGE, envelope.type, Buffer.from(JSON.stringify(envelope)), {
            persistent: true,
            contentType: 'application/json',
            messageId: envelope.eventId,
            type: envelope.type,
            headers: { ...headers },
          }),
        );
      }
      await channel.waitForConfirms();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.channel = undefined;
    await connection?.close().catch(() => undefined);
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    const connection = await connect(requiredEnv('RABBITMQ_URL'));
    // Sem listener, um 'error' da conexão derrubaria o processo.
    connection.on('error', (error: Error) => this.logger.warn(`RabbitMQ: ${error.message}`));
    connection.on('close', () => {
      if (this.connection === connection) {
        this.connection = undefined;
        this.channel = undefined;
      }
    });
    this.connection = connection;
    this.channel = await connection.createConfirmChannel();
    return this.channel;
  }
}
