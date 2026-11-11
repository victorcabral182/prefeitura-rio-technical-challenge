import { defineConfig } from 'prisma/config';

// DATABASE_URL vem do docker-compose (montada a partir do .env).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
