import { InvalidEmailError } from './errors.js';

// Value object: um e-mail sempre normalizado (sem espaços, minúsculo), para que
// "Fulano@Teste.local" e "fulano@teste.local" sejam o mesmo usuário.
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(value)) throw new InvalidEmailError();
    return new Email(value);
  }
}
