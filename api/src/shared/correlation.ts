import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-correlation-id';
// O valor do cliente vai parar nos logs e nos headers AMQP: só aceita um id
// curto, sem espaço nem quebra de linha. Fora disso, gera um novo.
const VALID = /^[\w.-]{1,64}$/;

const storage = new AsyncLocalStorage<string>();

// correlation_id da requisição em andamento (undefined fora de uma requisição).
export const correlationId = (): string | undefined => storage.getStore();

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && VALID.test(incoming) ? incoming : randomUUID();
  res.setHeader(HEADER, id);
  storage.run(id, next);
}
