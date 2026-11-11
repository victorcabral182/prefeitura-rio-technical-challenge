import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../domain/refresh-token.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  // Sempre termina sem erro: sair com uma sessão já inválida não é falha.
  // O access token continua válido até expirar (no máximo 15 minutos).
  async execute(secret: string, now = new Date()): Promise<void> {
    if (!secret) return;
    const token = await this.refreshTokens.findByHash(RefreshToken.hashSecret(secret));
    if (token && !token.revokedAt) await this.refreshTokens.revoke(token.id, now);
  }
}
