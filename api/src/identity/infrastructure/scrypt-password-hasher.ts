import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { PasswordHasher } from '../domain/password-hasher.js';

// Parâmetros mínimos recomendados pelo OWASP para scrypt: N=2^17, r=8, p=1.
// Custa ~128 MiB de memória por hash, por isso o maxmem acima do padrão (32 MiB).
const PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LENGTH = 64;
const DUMMY_SALT = Buffer.alloc(16);

function derive(password: string, salt: Buffer, params: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, params, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

// Formato: scrypt$N$r$p$salt$hash (base64url). Guardar os parâmetros junto
// permite aumentar o custo no futuro sem invalidar as senhas antigas.
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, PARAMS);
    const { N, r, p } = PARAMS;
    return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [algorithm, N, r, p, salt, key] = stored.split('$');
    if (algorithm !== 'scrypt' || !key) {
      // Hash ausente (usuário inexistente): gasta o mesmo tempo e recusa.
      await derive(password, DUMMY_SALT, PARAMS);
      return false;
    }
    const expected = Buffer.from(key, 'base64url');
    const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
    const actual = await derive(password, Buffer.from(salt, 'base64url'), params);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
