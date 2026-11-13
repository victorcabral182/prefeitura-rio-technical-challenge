// Carregado antes do worker (`node --import ./src/telemetry.ts`): as
// instrumentações precisam interceptar os módulos antes de o main importá-los.
// Em ESM isso exige o hook do import-in-the-middle, registrado aqui.
import { register } from 'node:module';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { NodeSDK } from '@opentelemetry/sdk-node';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// Nome do serviço e endpoint do Jaeger vêm de OTEL_SERVICE_NAME e
// OTEL_EXPORTER_OTLP_ENDPOINT (compose).
new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    // /health e /metrics não viram trace.
    new HttpInstrumentation({ ignoreIncomingRequestHook: () => true }),
    new AmqplibInstrumentation(),
    new IORedisInstrumentation(),
    new MongooseInstrumentation(),
    new PinoInstrumentation(),
  ],
}).start();
