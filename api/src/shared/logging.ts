import type { Params } from 'nestjs-pino';
import { correlationId } from './correlation.js';

// Uma linha JSON por evento no stdout. O correlation_id vem do AsyncLocalStorage
// da requisição; trace_id e span_id são injetados pela instrumentação do OTel
// para o pino quando há um span ativo.
export const loggerOptions: Params = {
  pinoHttp: {
    base: { service: 'api' },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: { level: (label) => ({ level: label }) },
    mixin: () => ({ correlation_id: correlationId() }),
    // Só o necessário da requisição: sem headers, então Authorization e o cookie
    // do refresh nunca chegam aos logs.
    serializers: {
      req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    // O Prometheus raspa o /metrics a cada 5s: logar isso só gera ruído.
    autoLogging: { ignore: (req) => req.url === '/metrics' },
  },
};
