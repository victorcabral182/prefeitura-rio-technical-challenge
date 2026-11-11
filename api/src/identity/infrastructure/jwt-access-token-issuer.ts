import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenIssuer } from '../application/access-token-issuer.js';
import type { User } from '../domain/user.js';
import type { AccessTokenPayload } from './jwt.config.js';

@Injectable()
export class JwtAccessTokenIssuer extends AccessTokenIssuer {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(user: User): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, type: user.type, name: user.name };
    return this.jwt.signAsync(payload);
  }
}
