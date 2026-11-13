import { Body, Controller, Get, HttpCode, Post, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginUseCase } from '../application/login.use-case.js';
import { LogoutUseCase } from '../application/logout.use-case.js';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case.js';
import { ACCESS_TOKEN_TTL_SECONDS, type Session } from '../application/session.service.js';
import { IdentityErrorFilter } from './identity-error.filter.js';
import { type AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard.js';
import { LoginDto } from './login.dto.js';
import type { Principal } from './principal.js';

const REFRESH_COOKIE = 'refresh_token';
// httpOnly: JavaScript da página não lê o token (XSS não o rouba).
// sameSite strict: o navegador não manda o cookie em requisições de outro site (CSRF).
// path /auth: o cookie só viaja para as rotas que precisam dele.
const REFRESH_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth' } as const;

@Controller('auth')
@UseFilters(IdentityErrorFilter)
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  async signIn(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    return respondWithSession(res, await this.login.execute(body.email, body.password));
  }

  @Post('refresh')
  @HttpCode(200)
  async renew(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return respondWithSession(res, await this.refresh.execute(refreshCookie(req)));
  }

  @Post('logout')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logout.execute(refreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest): Principal {
    return req.user;
  }
}

function refreshCookie(req: Request): string {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : '';
}

function respondWithSession(res: Response, session: Session) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: session.refreshTokenExpiresAt,
  });
  return { accessToken: session.accessToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
