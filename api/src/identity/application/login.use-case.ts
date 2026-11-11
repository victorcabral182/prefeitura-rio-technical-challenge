import { Injectable } from '@nestjs/common';
import { Email } from '../domain/email.js';
import { IdentityError, InvalidCredentialsError } from '../domain/errors.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import type { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';
import { SessionService, type Session } from './session.service.js';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async execute(email: string, password: string): Promise<Session> {
    const user = await this.findUser(email);
    // Verifica a senha mesmo sem usuário (contra um hash vazio), para o tempo
    // de resposta não revelar quais e-mails estão cadastrados.
    const passwordMatches = await this.hasher.verify(password, user?.passwordHash ?? '');
    if (!user || !passwordMatches) throw new InvalidCredentialsError();
    return this.sessions.start(user);
  }

  private async findUser(email: string): Promise<User | null> {
    try {
      return await this.users.findByEmail(Email.create(email));
    } catch (error) {
      if (error instanceof IdentityError) return null;
      throw error;
    }
  }
}
