import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../domain/refresh-token.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';
import type { User } from '../domain/user.js';
import { AccessTokenIssuer } from './access-token-issuer.js';

// Política de sessão num lugar só: o JWT, a resposta HTTP e o cookie leem daqui.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type Session = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

// Login e refresh terminam do mesmo jeito: access token novo + refresh token novo.
@Injectable()
export class SessionService {
  constructor(
    private readonly accessTokens: AccessTokenIssuer,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async start(user: User, now = new Date()): Promise<Session> {
    const refreshToken = RefreshToken.generateSecret();
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: RefreshToken.hashSecret(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });
    return { accessToken: await this.accessTokens.issue(user), refreshToken, refreshTokenExpiresAt };
  }
}
