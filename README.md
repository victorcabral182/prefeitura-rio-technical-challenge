# Corridas — desafio técnico Prefeitura do Rio

Versão simplificada do fluxo do Taxi.Rio: API NestJS, worker Node, UI React, MySQL, Redis, MongoDB e RabbitMQ.

## Como rodar

Pré-requisito: Docker (testado com Engine 29 / Compose 5.4).

```bash
cp .env.example .env                # credenciais locais; o .env não é versionado
docker compose up --build --watch   # sobe tudo com hot reload
```

Sem `--watch` o ambiente sobe igual, só não sincroniza as alterações de código.

| Serviço           | URL                                                                     |
| ----------------- | ----------------------------------------------------------------------- |
| UI                | http://localhost:5173                                                   |
| API               | http://localhost:3000                                                   |
| RabbitMQ (painel) | http://localhost:15672 (`RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` do `.env`) |

Testes, lint e typecheck rodam dentro dos containers:

```bash
docker compose exec api npm test
docker compose exec api npm run lint
docker compose exec worker sh -c 'npm run typecheck && npm run lint'
docker compose exec ui npm run lint
```

Apagar os dados (MySQL/Mongo) e recomeçar: `docker compose down -v`.

### Migrations (Prisma)

As migrations pendentes são aplicadas automaticamente quando o container da api sobe (`prisma migrate deploy`). Para criar uma nova depois de alterar `api/prisma/schema.prisma`:

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -v ./api/prisma:/app/prisma api \
  npx prisma migrate dev --create-only --name <nome>
```

O volume grava a migration em `api/prisma/migrations` no host, e o `--watch` rebuilda a api e aplica a migration no próximo start. O `migrate dev` usa um banco temporário (shadow database); a permissão para isso é concedida ao usuário da aplicação por `mysql/initdb/`, só no ambiente de dev.

## Estrutura

| Pasta     | Stack                                                       |
| --------- | ----------------------------------------------------------- |
| `api/`    | NestJS 12 (ESM, Vitest, oxlint)                             |
| `worker/` | Node 24 + TypeScript executado nativamente (sem build)      |
| `ui/`     | Vite 8 + React 19                                           |

Cada pasta é um pacote npm independente, com seu próprio `package-lock.json` e `Dockerfile`.

## Uso de IA

Desenvolvido em par com o Claude Code (Anthropic). Até agora a IA ajudou no scaffold dos três pacotes, no `docker-compose.yml` e nos Dockerfiles, no diagnóstico do Mongo no kernel 7.0 e na medição de CPU dos healthchecks (detalhes no [DIARIO.md](DIARIO.md)).

Sugestões que falharam no teste e foram corrigidas:

- `mongo:8` não sobe em kernel ≥ 6.19 (SERVER-121912). Trocado por `mongo:9` depois de testar as duas imagens.
- O healthcheck do RabbitMQ a cada 10s gerava picos de 172% de CPU com o ambiente parado. Agora todos os healthchecks rodam a cada 2s só durante o boot e a cada 30s depois.
