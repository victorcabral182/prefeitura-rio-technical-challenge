import { Injectable } from '@nestjs/common';
import type { Usuario } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { Email } from '../domain/email.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

// O banco fala português (usuarios, senha_hash) e o domínio inglês; a tradução
// fica só aqui.
function toDomain(row: Usuario): User {
  return new User(row.id, row.nome, Email.create(row.email), row.senhaHash, row.tipo);
}

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.usuario.findUnique({ where: { email: email.value } });
    return row && toDomain(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.usuario.findUnique({ where: { id } });
    return row && toDomain(row);
  }
}
