// Usuários de teste para avaliar o projeto localmente. Roda a cada start do
// container: cria só quem falta e nunca sobrescreve (senha trocada continua trocada).
// A senha é de teste, documentada no README; não use em nenhum outro lugar.
import { ScryptPasswordHasher } from '../src/identity/infrastructure/scrypt-password-hasher.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import type { TipoUsuario } from '../src/generated/prisma/client.js';

const TEST_PASSWORD = 'senha-de-teste';
const USERS: { nome: string; email: string; tipo: TipoUsuario }[] = [
  { nome: 'Passageira de Teste', email: 'passageiro@teste.local', tipo: 'passageiro' },
  { nome: 'Passageiro de Teste 2', email: 'passageiro2@teste.local', tipo: 'passageiro' },
  { nome: 'Motorista de Teste', email: 'motorista@teste.local', tipo: 'motorista' },
];

const prisma = new PrismaService();
const hasher = new ScryptPasswordHasher();
try {
  for (const user of USERS) {
    const exists = await prisma.usuario.findUnique({ where: { email: user.email } });
    if (exists) continue;
    await prisma.usuario.create({ data: { ...user, senhaHash: await hasher.hash(TEST_PASSWORD) } });
    console.log(`seed: criado ${user.email}`);
  }
} finally {
  await prisma.$disconnect();
}
