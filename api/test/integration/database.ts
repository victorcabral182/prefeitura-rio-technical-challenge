import { PrismaService } from '../../src/shared/prisma/prisma.service.js';

const TEST_DATABASE = 'corridas_test';

// Mesmo servidor e usuário do dev, banco separado: os testes apagam tabelas
// inteiras e não podem encostar nos dados de dev.
export function testDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

// Trava de segurança: só limpa se a conexão for mesmo do banco de teste.
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
  if (db !== TEST_DATABASE) throw new Error(`Recusando limpar o banco ${db}`);
  // Ordem das FKs: filhos antes dos pais.
  await prisma.outboxEvento.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.corrida.deleteMany();
  await prisma.usuario.deleteMany();
}

export function createUser(prisma: PrismaService, tipo: 'passageiro' | 'motorista', email: string) {
  return prisma.usuario.create({ data: { nome: email, email, senhaHash: 'nao-usado', tipo } });
}
