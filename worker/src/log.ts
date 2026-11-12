import { pino } from 'pino';

// Mesmo formato da api (nestjs-pino): uma linha JSON por evento. trace_id e
// span_id entram sozinhos pela instrumentação do OTel quando há span ativo
// (o consume de cada mensagem).
const logger = pino({
  base: { service: 'worker' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
});

export function log(level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}): void {
  logger[level](fields, msg);
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`);
  return value;
}
