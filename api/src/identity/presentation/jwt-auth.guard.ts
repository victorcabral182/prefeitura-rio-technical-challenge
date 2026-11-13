import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../infrastructure/jwt.config.js';
import type { Principal } from './principal.js';

export type AuthenticatedRequest = Request & { user: Principal };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      // Assinatura, expiração, issuer, audience e algoritmo vêm do JwtModule.
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { id: payload.sub, type: payload.type, name: payload.name };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
