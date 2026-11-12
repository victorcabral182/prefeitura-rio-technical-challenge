// Carregado antes da aplicação (`node --import ./dist/instrumentation.js`): as
// instrumentações precisam interceptar os módulos antes de a api importá-los.
// Em ESM isso exige o hook do import-in-the-middle, registrado aqui.
import { register } from 'node:module';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// Nome do serviço e endpoint do Jaeger vêm de OTEL_SERVICE_NAME e
// OTEL_EXPORTER_OTLP_ENDPOINT (compose).
new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    // O scrape do Prometheus não vira trace.
    new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/metrics' }),
    // Um span por middleware (cors, cookieParser...) só polui o trace.
    new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE] }),
    new PrismaInstrumentation(),
    new IORedisInstrumentation(),
    new AmqplibInstrumentation(),
    new PinoInstrumentation(),
  ],
}).start();
