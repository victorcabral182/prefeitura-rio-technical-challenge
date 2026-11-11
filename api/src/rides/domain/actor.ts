import type { UserType } from '../../identity/domain/user-type.js';

// Quem executa a ação, como o contexto de identidade o autenticou.
export type Actor = { id: string; type: UserType };
