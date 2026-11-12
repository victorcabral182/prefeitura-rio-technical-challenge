import { log } from './log.ts';
import { eventLagSeconds, messages, processingSeconds } from './metrics.ts';
import { parseRideEvent, type RideEvent, type RideSnapshot } from './ride-event.ts';

// Cada escrita é idempotente por si: reprocessar a mesma mensagem não muda nada,
// e uma reentrega depois de falha no meio completa o que faltou.
export type Stores = {
  // false = eventId já estava no histórico.
  saveHistory(event: RideEvent, correlationId: string | undefined): Promise<boolean>;
  // false = o cache já tinha versão igual ou mais nova.
  saveCache(snapshot: RideSnapshot): Promise<boolean>;
};

export type Outcome = 'ack' | 'dead-letter' | 'retry';

export async function handleMessage(
  body: Buffer,
  correlationId: string | undefined,
  stores: Stores,
): Promise<Outcome> {
  const event = parseRideEvent(body);
  if (!event) {
    log('error', 'mensagem inválida, enviada para a DLQ', { correlation_id: correlationId });
    messages.inc({ type: 'invalida', outcome: 'dead-letter' });
    return 'dead-letter';
  }
  const fields = {
    correlation_id: correlationId,
    eventId: event.eventId,
    type: event.type,
    corridaId: event.data.id,
    versao: event.data.versao,
  };
  const endTimer = processingSeconds.startTimer();
  try {
    // Sempre as duas: se o histórico já existia (reentrega), o cache pode ser
    // justamente o que faltou da primeira vez.
    const history = await stores.saveHistory(event, correlationId);
    const cache = await stores.saveCache(event.data);
    endTimer();
    eventLagSeconds.observe((Date.now() - Date.parse(event.occurredAt)) / 1000);
    messages.inc({ type: event.type, outcome: 'ack' });
    log('info', 'evento processado', { ...fields, historico: history ? 'gravado' : 'duplicado', cache: cache ? 'gravado' : 'versao antiga' });
    return 'ack';
  } catch (error) {
    messages.inc({ type: event.type, outcome: 'retry' });
    log('warn', 'falha ao processar, nova tentativa', { ...fields, error: (error as Error).message });
    return 'retry';
  }
}
