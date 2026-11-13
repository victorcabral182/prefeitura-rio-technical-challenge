// Todo erro do contexto identity é falha de autenticação; a camada HTTP traduz para 401.
// As mensagens são genéricas de propósito, para não revelar se o e-mail existe
// ou por que a sessão foi recusada.
export abstract class IdentityError extends Error {}

export class InvalidEmailError extends IdentityError {
  constructor() {
    super('E-mail inválido');
  }
}

export class InvalidCredentialsError extends IdentityError {
  constructor() {
    super('E-mail ou senha inválidos');
  }
}

export class InvalidRefreshTokenError extends IdentityError {
  constructor() {
    super('Sessão inválida ou expirada');
  }
}

export class RefreshTokenReuseError extends IdentityError {
  constructor(readonly userId: string) {
    super('Sessão inválida ou expirada');
  }
}
