import type { JwtModuleOptions } from '@nestjs/jwt';
import { readSecretFile } from '../../shared/env.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../application/session.service.js';
import type { UserType } from '../domain/user-type.js';

export type AccessTokenPayload = { sub: string; type: UserType; name: string };

const ISSUER = 'corridas-api';
const AUDIENCE = 'corridas';

// RS256: a chave privada só assina (login/refresh), a pública só valida. Quem
// precisar validar tokens recebe a pública sem conseguir emitir tokens.
// `algorithms` fixo impede um token com alg "none" ou HS256 de passar.
export function jwtOptions(): JwtModuleOptions {
  return {
    privateKey: readSecretFile('JWT_PRIVATE_KEY_FILE'),
    publicKey: readSecretFile('JWT_PUBLIC_KEY_FILE'),
    signOptions: {
      algorithm: 'RS256',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: ISSUER,
      audience: AUDIENCE,
    },
    verifyOptions: { algorithms: ['RS256'], issuer: ISSUER, audience: AUDIENCE },
  };
}
