import type { User } from '../domain/user.js';

export abstract class AccessTokenIssuer {
  abstract issue(user: User): Promise<string>;
}
