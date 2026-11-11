import { Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/errors.js';
import { RefreshToken } from '../domain/refresh-token.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import { UserRepository } from '../domain/user.repository.js';
import { SessionService, type Session } from './session.service.js';

// Rotação com detecção de reuso (OAuth 2.0 Security BCP): cada refresh consome o
// token e entrega outro; se um token já consumido reaparecer, alguém o copiou,
// então todas as sessões do usuário caem e ele precisa logar de novo.
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
  ) {}

  async execute(secret: string, now = new Date()): Promise<Session> {
    if (!secret) throw new InvalidRefreshTokenError();
    const token = await this.refreshTokens.findByHash(RefreshToken.hashSecret(secret));
    if (!token) throw new InvalidRefreshTokenError();

    try {
      token.assertUsable(now);
    } catch (error) {
      if (error instanceof RefreshTokenReuseError) {
        await this.refreshTokens.revokeAllForUser(error.userId, now);
      }
      throw error;
    }

    // Duas requisições com o mesmo token: só a primeira consegue marcar como usado.
    if (!(await this.refreshTokens.markUsed(token.id, now))) {
      await this.refreshTokens.revokeAllForUser(token.userId, now);
      throw new RefreshTokenReuseError(token.userId);
    }

    const user = await this.users.findById(token.userId);
    if (!user) throw new InvalidRefreshTokenError();
    return this.sessions.start(user, now);
  }
}
