import { readFileSync } from 'node:fs';

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`);
  return value;
}

// Segredos chegam como arquivo (compose secrets / Secret do Kubernetes) e a
// variável aponta para o caminho, para o conteúdo não aparecer em `docker inspect`.
export function readSecretFile(pathEnvName: string): string {
  return readFileSync(requiredEnv(pathEnvName), 'utf8');
}
