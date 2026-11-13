// Perfis do enunciado: passageiro cria e lê as próprias corridas, motorista altera status.
export const USER_TYPES = ['passageiro', 'motorista'] as const;

export type UserType = (typeof USER_TYPES)[number];
