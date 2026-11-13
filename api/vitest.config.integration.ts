import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/integration/database.js';

// Testes contra o MySQL de verdade, para o que só o banco garante: UNIQUE sob
// concorrência, FOR UPDATE, UPDATE condicional e atomicidade do outbox.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    env: { DATABASE_URL: testDatabaseUrl() },
    // Todos os arquivos dividem o mesmo banco e o limpam antes de cada teste.
    fileParallelism: false,
  },
});
