export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  // Deve levar o mesmo tempo mesmo com um hash vazio ou malformado, para o
  // login de um e-mail inexistente não responder mais rápido.
  abstract verify(password: string, hash: string): Promise<boolean>;
}
