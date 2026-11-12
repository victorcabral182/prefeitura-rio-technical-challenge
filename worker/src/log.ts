type Level = 'info' | 'warn' | 'error';

// Uma linha JSON por evento no stdout, com campos (correlation_id, eventId) para
// filtrar. ponytail: sem lib; a escolha (pino etc.) vem na Parte 2, junto com a api.
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, service: 'worker', msg, ...fields }));
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`);
  return value;
}
