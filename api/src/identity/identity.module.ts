import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenIssuer } from './application/access-token-issuer.js';
import { LoginUseCase } from './application/login.use-case.js';
import { LogoutUseCase } from './application/logout.use-case.js';
import { RefreshSessionUseCase } from './application/refresh-session.use-case.js';
import { SessionService } from './application/session.service.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { RefreshTokenRepository } from './domain/refresh-token.repository.js';
import { UserRepository } from './domain/user.repository.js';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token-issuer.js';
import { jwtOptions } from './infrastructure/jwt.config.js';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository.js';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { AuthController } from './presentation/auth.controller.js';
import { JwtAuthGuard } from './presentation/jwt-auth.guard.js';

// Único lugar que liga os contratos do domínio/aplicação às implementações.
@Module({
  imports: [JwtModule.registerAsync({ useFactory: jwtOptions })],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    SessionService,
    JwtAuthGuard,
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer },
  ],
  // Outros contextos (corridas) protegem rotas com o mesmo guard.
  exports: [JwtAuthGuard, JwtModule],
})
export class IdentityModule {}
