import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('valida a senha certa e recusa a errada', async () => {
    const hash = await hasher.hash('senha-de-teste');
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await hasher.verify('senha-de-teste', hash)).toBe(true);
    expect(await hasher.verify('outra', hash)).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    expect(await hasher.hash('x')).not.toBe(await hasher.hash('x'));
  });

  it('recusa hash vazio ou malformado sem lançar erro', async () => {
    expect(await hasher.verify('x', '')).toBe(false);
    expect(await hasher.verify('x', 'lixo')).toBe(false);
  });
});
