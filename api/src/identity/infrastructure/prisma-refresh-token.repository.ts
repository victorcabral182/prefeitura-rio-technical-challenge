import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { RefreshToken } from '../domain/refresh-token.js';
import { RefreshTokenRepository } from '../domain/refresh-token.repository.js';

@Injectable()
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { usuarioId: data.userId, tokenHash: data.tokenHash, expiraEm: data.expiresAt },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return row && new RefreshToken(row.id, row.usuarioId, row.expiraEm, row.usadoEm, row.revogadoEm);
  }

  // UPDATE ... WHERE usado_em IS NULL é atômico no MySQL: entre dois refresh
  // simultâneos com o mesmo token, só um afeta a linha.
  async markUsed(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, usadoEm: null, revogadoEm: null },
      data: { usadoEm: at },
    });
    return count === 1;
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revogadoEm: at } });
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: userId, revogadoEm: null },
      data: { revogadoEm: at },
    });
  }
}
