import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { type ConsumeMessage, connect } from 'amqplib';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { handleMessage } from './handle-message.ts';
import { log, requiredEnv } from './log.ts';
import { createStores } from './stores.ts';

const QUEUE = 'worker.corridas';
// Mensagens em processamento ao mesmo tempo (sem ack).
const PREFETCH = 10;
// Mongo/Redis fora: espera antes de devolver a mensagem à fila, para uma queda
// curta não esgotar o delivery-limit da fila quorum (20) e mandar mensagem boa
// para a DLQ.
const RETRY_DELAY_MS = 5000;
const port = Number(process.env.PORT ?? 9100);

let shuttingDown = false;

// Sem reconexão no processo: caiu a conexão, o processo sai e o compose/k8s
// reinicia. As mensagens sem ack voltam para a fila sozinhas.
function exitOnFailure(reason: string, error?: Error): never {
  log('error', `${reason}; encerrando para o orquestrador reiniciar`, { error: error?.message });
  process.exit(1);
}

await mongoose.connect(requiredEnv('MONGO_URL')).catch((error: Error) => exitOnFailure('MongoDB indisponível', error));
const redis = new Redis(requiredEnv('REDIS_URL'), { maxRetriesPerRequest: 1 });
redis.on('error', (error: Error) => log('warn', 'Redis indisponível', { error: error.message }));
const stores = createStores(redis);

const connection = await connect(requiredEnv('RABBITMQ_URL')).catch((error: Error) =>
  exitOnFailure('RabbitMQ indisponível', error),
);
connection.on('error', (error: Error) => log('warn', 'RabbitMQ', { error: error.message }));
connection.on('close', () => {
  if (!shuttingDown) exitOnFailure('conexão com o RabbitMQ fechada');
});
const channel = await connection.createChannel();
await channel.prefetch(PREFETCH);

async function onMessage(message: ConsumeMessage): Promise<void> {
  const header = message.properties.headers?.correlation_id;
  const correlationId = typeof header === 'string' ? header : undefined;
  const outcome = await handleMessage(message.content, correlationId, stores);
  if (outcome === 'retry') await sleep(RETRY_DELAY_MS);
  if (shuttingDown) return; // canal fechando: a mensagem volta para a fila
  if (outcome === 'ack') channel.ack(message);
  // requeue=false manda para a DLQ (x-dead-letter-routing-key da fila).
  else channel.nack(message, false, outcome === 'retry');
}

await channel.consume(QUEUE, (message) => {
  if (!message) exitOnFailure('consumidor cancelado pelo broker');
  void onMessage(message);
});

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
    return;
  }
  res.writeHead(404).end();
});
server.listen(port, () => log('info', `consumindo ${QUEUE}; /health na porta ${port}`));

// Fecha a conexão sem esperar as mensagens em processamento: as sem ack voltam
// para a fila e o reprocessamento é idempotente.
process.on('SIGTERM', () => {
  shuttingDown = true;
  void Promise.allSettled([connection.close(), mongoose.disconnect(), redis.quit()]).then(() =>
    server.close(() => process.exit(0)),
  );
});
