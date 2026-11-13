import type { RefreshToken } from './refresh-token.js';

export abstract class RefreshTokenRepository {
  abstract create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<RefreshToken | null>;
  // Marca como usado só se ainda estiver livre. false significa que outro uso
  // do mesmo token chegou antes (duas requisições simultâneas).
  abstract markUsed(id: string, at: Date): Promise<boolean>;
  abstract revoke(id: string, at: Date): Promise<void>;
  abstract revokeAllForUser(userId: string, at: Date): Promise<void>;
}
