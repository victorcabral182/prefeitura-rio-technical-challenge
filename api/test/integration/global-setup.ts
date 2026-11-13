import { execSync } from 'node:child_process';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { testDatabaseUrl } from './database.js';

// Cria o banco de teste se faltar e aplica as mesmas migrations do dev.
export default async function setup(): Promise<void> {
  const admin = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL ?? '') });
  await admin.$executeRawUnsafe('CREATE DATABASE IF NOT EXISTS corridas_test');
  await admin.$disconnect();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'ignore',
  });
}
