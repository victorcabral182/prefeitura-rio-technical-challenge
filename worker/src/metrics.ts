import { collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// CPU, memória, event loop lag e GC do processo.
collectDefaultMetrics();

// Mensagens por resultado: ack, dead-letter (DLQ) ou retry (Redis/Mongo fora).
export const messages = new Counter({
  name: 'worker_messages_total',
  help: 'Mensagens consumidas por tipo de evento e resultado',
  labelNames: ['type', 'outcome'] as const,
});

export const processingSeconds = new Histogram({
  name: 'worker_message_processing_seconds',
  help: 'Tempo para gravar histórico e cache de uma mensagem',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

// Atraso de ponta a ponta: da escrita na api (occurredAt) até o worker gravar.
// Soma o polling do outbox, o broker e a espera na fila. É o atraso que o
// usuário vê no GET.
export const eventLagSeconds = new Histogram({
  name: 'worker_event_lag_seconds',
  help: 'Do occurredAt do evento até o processamento no worker',
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120],
});
