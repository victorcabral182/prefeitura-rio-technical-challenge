import { createHash, randomBytes } from 'node:crypto';
import { InvalidRefreshTokenError, RefreshTokenReuseError } from './errors.js';

export class RefreshToken {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly expiresAt: Date,
    readonly usedAt: Date | null,
    readonly revokedAt: Date | null,
  ) {}

  // Revogado ou expirado: inválido. Já usado: reuso, sinal de que o token
  // vazou, porque o dono legítimo sempre troca pelo token novo da rotação.
  assertUsable(now: Date): void {
    if (this.revokedAt || this.expiresAt <= now) throw new InvalidRefreshTokenError();
    if (this.usedAt) throw new RefreshTokenReuseError(this.userId);
  }

  // O cliente recebe o segredo aleatório; o banco guarda só o SHA-256 dele,
  // então vazar a tabela não entrega tokens utilizáveis.
  static generateSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
