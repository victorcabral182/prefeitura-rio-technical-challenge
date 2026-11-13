import { describe, expect, it } from 'vitest';
import { Email } from '../domain/email.js';
import { InvalidCredentialsError, InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/errors.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { RefreshToken } from '../domain/refresh-token.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';
import { AccessTokenIssuer } from './access-token-issuer.js';
import { LoginUseCase } from './login.use-case.js';
import { LogoutUseCase } from './logout.use-case.js';
import { REFRESH_TOKEN_TTL_MS, SessionService } from './session.service.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';

// Fakes em memória: os casos de uso só conhecem os contratos, então dá para
// testar a regra sem banco, sem scrypt e sem chave RSA.
const alice = new User('u1', 'Alice', Email.create('alice@teste.local'), 'hash:senha', 'passageiro');

class FakeUsers extends UserRepository {
  findByEmail = (email: Email) => Promise.resolve(email.value === alice.email.value ? alice : null);
  findById = (id: string) => Promise.resolve(id === alice.id ? alice : null);
}

class FakeHasher extends PasswordHasher {
  hash = (password: string) => Promise.resolve(`hash:${password}`);
  verify = (password: string, hash: string) => Promise.resolve(hash === `hash:${password}`);
}

class FakeIssuer extends AccessTokenIssuer {
  issue = (user: User) => Promise.resolve(`jwt-de-${user.id}`);
}

type Row = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; revokedAt: Date | null };

class FakeRefreshTokens extends RefreshTokenRepository {
  rows: Row[] = [];
  create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.rows.push({ id: `t${this.rows.length}`, ...data, usedAt: null, revokedAt: null });
    return Promise.resolve();
  }
  findByHash(tokenHash: string) {
    const r = this.rows.find((row) => row.tokenHash === tokenHash);
    return Promise.resolve(r ? new RefreshToken(r.id, r.userId, r.expiresAt, r.usedAt, r.revokedAt) : null);
  }
  markUsed(id: string, at: Date) {
    const r = this.rows.find((row) => row.id === id && !row.usedAt && !row.revokedAt);
    if (r) r.usedAt = at;
    return Promise.resolve(Boolean(r));
  }
  revoke(id: string, at: Date) {
    this.rows.find((row) => row.id === id)!.revokedAt = at;
    return Promise.resolve();
  }
  revokeAllForUser(userId: string, at: Date) {
    for (const row of this.rows) if (row.userId === userId && !row.revokedAt) row.revokedAt = at;
    return Promise.resolve();
  }
}

function setup() {
  const users = new FakeUsers();
  const tokens = new FakeRefreshTokens();
  const sessions = new SessionService(new FakeIssuer(), tokens);
  return {
    tokens,
    login: new LoginUseCase(users, new FakeHasher(), sessions),
    refresh: new RefreshSessionUseCase(tokens, users, sessions),
    logout: new LogoutUseCase(tokens),
  };
}

describe('login', () => {
  it('entrega access token e guarda só o hash do refresh token', async () => {
    const { login, tokens } = setup();
    const session = await login.execute(' Alice@Teste.local ', 'senha');
    expect(session.accessToken).toBe('jwt-de-u1');
    expect(tokens.rows[0].tokenHash).toBe(RefreshToken.hashSecret(session.refreshToken));
    expect(tokens.rows[0].tokenHash).not.toBe(session.refreshToken);
  });

  it.each([
    ['senha errada', 'alice@teste.local', 'outra'],
    ['e-mail desconhecido', 'bob@teste.local', 'senha'],
    ['e-mail malformado', 'nao-e-email', 'senha'],
  ])('recusa %s com o mesmo erro genérico', async (_, email, password) => {
    const { login } = setup();
    await expect(login.execute(email, password)).rejects.toThrow(InvalidCredentialsError);
  });
});

describe('refresh', () => {
  it('troca o refresh token por um novo e consome o antigo', async () => {
    const { login, refresh, tokens } = setup();
    const first = await login.execute('alice@teste.local', 'senha');
    const second = await refresh.execute(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(tokens.rows[0].usedAt).not.toBeNull();
    expect(tokens.rows[1].usedAt).toBeNull();
  });

  it('reuso de token consumido derruba todas as sessões do usuário', async () => {
    const { login, refresh, tokens } = setup();
    const stolen = await login.execute('alice@teste.local', 'senha');
    const legit = await refresh.execute(stolen.refreshToken);
    await expect(refresh.execute(stolen.refreshToken)).rejects.toThrow(RefreshTokenReuseError);
    expect(tokens.rows.every((row) => row.revokedAt)).toBe(true);
    await expect(refresh.execute(legit.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('recusa token expirado, desconhecido ou ausente', async () => {
    const { login, refresh } = setup();
    const session = await login.execute('alice@teste.local', 'senha');
    const later = new Date(Date.now() + REFRESH_TOKEN_TTL_MS + 1);
    await expect(refresh.execute(session.refreshToken, later)).rejects.toThrow(InvalidRefreshTokenError);
    await expect(refresh.execute('inventado')).rejects.toThrow(InvalidRefreshTokenError);
    await expect(refresh.execute('')).rejects.toThrow(InvalidRefreshTokenError);
  });
});

describe('logout', () => {
  it('revoga o refresh token, que deixa de renovar', async () => {
    const { login, refresh, logout } = setup();
    const session = await login.execute('alice@teste.local', 'senha');
    await logout.execute(session.refreshToken);
    await expect(refresh.execute(session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });
});
