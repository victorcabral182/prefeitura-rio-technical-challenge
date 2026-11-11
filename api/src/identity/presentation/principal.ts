import type { UserType } from '../domain/user-type.js';

// Quem está autenticado na requisição, extraído do access token.
export type Principal = { id: string; type: UserType; name: string };
