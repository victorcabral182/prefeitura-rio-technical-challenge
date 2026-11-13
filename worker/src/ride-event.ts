// Cópia do contrato publicado pela api (envelope do outbox + RideSnapshot). Sem
// pacote compartilhado entre api e worker: ver DECISIONS.md, entrada 1.
export type RideSnapshot = {
  id: string;
  origem: string;
  destino: string;
  status: string;
  passageiroId: string;
  motoristaId: string | null;
  versao: number;
  criadaEm: string;
  atualizadaEm: string;
};

export type RideEvent = { eventId: string; type: string; occurredAt: string; data: RideSnapshot };

// null = mensagem que nunca vai ser processável (vai para a DLQ sem retry).
export function parseRideEvent(body: Buffer): RideEvent | null {
  let event: Partial<RideEvent>;
  try {
    event = JSON.parse(body.toString('utf8')) as Partial<RideEvent>;
  } catch {
    return null;
  }
  const data = event?.data;
  const valid =
    typeof event.eventId === 'string' &&
    typeof event.type === 'string' &&
    typeof event.occurredAt === 'string' &&
    !Number.isNaN(Date.parse(event.occurredAt)) &&
    typeof data?.id === 'string' &&
    typeof data.status === 'string' &&
    Number.isInteger(data.versao);
  return valid ? (event as RideEvent) : null;
}
