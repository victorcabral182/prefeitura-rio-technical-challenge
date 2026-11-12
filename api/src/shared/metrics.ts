import { Controller, Get, Header } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

// CPU, memória, event loop lag e GC do processo.
collectDefaultMetrics();

const labelNames = ['method', 'route', 'status'] as const;
const requests = new Counter({ name: 'http_requests_total', help: 'Requisições HTTP atendidas', labelNames });
const duration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Latência das requisições HTTP',
  labelNames,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Taxa, erros (status >= 500) e latência por rota. A rota é o template do
// Express (/corridas/:id), nunca a URL: um id por série explodiria a cardinalidade.
export function httpMetrics(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics' || req.path === '/health') return next();
  const end = duration.startTimer();
  res.on('finish', () => {
    const route = (req.route as { path?: string } | undefined)?.path;
    const labels = { method: req.method, route: route ? req.baseUrl + route : 'sem_rota', status: String(res.statusCode) };
    end(labels);
    requests.inc(labels);
  });
  next();
}

// ponytail: /metrics público na porta da api; em produção, porta separada ou
// acesso restrito à rede do Prometheus.
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  metrics(): Promise<string> {
    return register.metrics();
  }
}
