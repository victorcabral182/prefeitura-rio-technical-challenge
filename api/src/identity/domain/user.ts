import type { Email } from './email.js';
import type { UserType } from './user-type.js';

export class User {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: Email,
    readonly passwordHash: string,
    readonly type: UserType,
  ) {}
}
