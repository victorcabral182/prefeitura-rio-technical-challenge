# Corridas — desafio técnico Prefeitura do Rio

Versão simplificada do fluxo do Taxi.Rio: API NestJS, worker Node, UI React, MySQL, Redis, MongoDB e RabbitMQ.

## Como rodar

Pré-requisito: Docker (testado com Engine 29 / Compose 5.4).

```bash
cp .env.example .env                # credenciais locais; o .env não é versionado
./scripts/gerar-chaves-jwt.sh       # par RSA do JWT em secrets/ (também fora do git)
docker compose up --build --watch   # sobe tudo com hot reload
```

Sem `--watch` o ambiente sobe igual, só não sincroniza as alterações de código.

| Serviço           | URL                                                                     |
| ----------------- | ----------------------------------------------------------------------- |
| UI                | http://localhost:5173                                                   |
| API               | http://localhost:3000                                                   |
| RabbitMQ (painel) | http://localhost:15672 (`RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` do `.env`) |

### Autenticação

Usuários de teste criados automaticamente no start da api (senha de teste, só para avaliação local):

| E-mail                    | Tipo       | Senha            |
| ------------------------- | ---------- | ---------------- |
| `passageiro@teste.local`  | passageiro | `senha-de-teste` |
| `passageiro2@teste.local` | passageiro | `senha-de-teste` |
| `motorista@teste.local`   | motorista  | `senha-de-teste` |

| Rota                 | O que faz                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `POST /auth/login`   | `{ email, password }` → access token JWT (RS256, 15 min) no corpo + refresh token em cookie httpOnly (1 dia) |
| `POST /auth/refresh` | troca o refresh token do cookie por um par novo; reusar um token já trocado derruba todas as sessões do usuário |
| `POST /auth/logout`  | revoga o refresh token e apaga o cookie                                                       |
| `GET /auth/me`       | `Authorization: Bearer <token>` → usuário autenticado                                         |

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"email":"passageiro@teste.local","password":"senha-de-teste"}' \
  http://localhost:3000/auth/login
```

### Corridas

Todas as rotas exigem `Authorization: Bearer <token>`. Passageiro cria e lê só as próprias corridas; motorista lê as abertas e as que aceitou, e só ele altera status (um motorista tem no máximo uma corrida em aberto).

| Rota                          | O que faz                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `POST /corridas`              | passageiro, `{ origem, destino }` + cabeçalho `Idempotency-Key` obrigatório; reenvio com a mesma chave devolve a mesma corrida, chave reaproveitada com outro corpo → 422 |
| `GET /corridas`               | as 50 mais recentes visíveis para o perfil (rota extra, para a tela de listagem)               |
| `GET /corridas/:id`           | lê do cache Redis (gravado pelo worker) e, no miss, do MySQL                                    |
| `PATCH /corridas/:id/status`  | motorista, `{ status }`: `aceita` → `em_andamento` → `finalizada`; fora de ordem → 409          |

Cada escrita grava o evento (`corrida.criada`, `corrida.status_alterado`) no outbox do MySQL na mesma transação, e a api publica no RabbitMQ em até ~1s. A topologia (exchange `corridas`, fila `worker.corridas`, DLQ) está em `rabbitmq/definitions.json` e é aplicada pelo serviço `rabbitmq-init` antes de api e worker subirem.

```bash
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"email":"passageiro@teste.local","password":"senha-de-teste"}' \
  http://localhost:3000/auth/login | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" -d '{"origem":"Centro","destino":"Barra"}' \
  http://localhost:3000/corridas
```

Testes, lint e typecheck rodam dentro dos containers:

```bash
docker compose exec api npm test                  # unitários, sem banco
docker compose exec api npm run test:integration  # contra o MySQL, no banco separado corridas_test
docker compose exec api npm run lint
docker compose exec worker sh -c 'npm run typecheck && npm run lint'
docker compose exec ui npm run lint
```

O CI (`.github/workflows/ci.yml`) roda esses mesmos comandos dentro das imagens do compose em todo PR para `develop` ou `main`, a partir de um `.env` copiado do `.env.example` e de chaves JWT geradas na hora.

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
