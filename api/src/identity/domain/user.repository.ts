import type { Email } from './email.js';
import type { User } from './user.js';

// Classe abstrata em vez de interface: no Nest ela é ao mesmo tempo o tipo e o
// token de injeção, e a implementação (Prisma) fica na infraestrutura.
export abstract class UserRepository {
  abstract findByEmail(email: Email): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
}
