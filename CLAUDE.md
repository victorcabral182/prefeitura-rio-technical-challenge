# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Desafio técnico (Prefeitura do Rio): serviço de corridas simplificado do Taxi.Rio. Monorepo com três pacotes npm independentes (`api/`, `worker/`, `ui/`), cada um com `package.json`, lockfile e `Dockerfile` próprios. Docs e contrato externo em português; código em inglês.

## Regras de trabalho

- **Decisões técnicas são do usuário.** Antes de qualquer escolha (lib, arquitetura, formato, nome de branch, o que versionar, interpretação do enunciado), apresentar opções com trade-offs e recomendação, e esperar. Uma pergunta por vez. Tarefas puramente mecânicas ou de layout dispensam pergunta; listar as escolhas feitas no fim.
- **Tudo roda dentro dos containers** (`docker compose exec ...`), nunca no host: o host tem Node 22, os containers Node 24, e o client Prisma gerado (`api/src/generated/prisma`, gitignored) só existe dentro da imagem.
- Commit e push só quando o usuário pedir. Commits pequenos, Conventional Commits, mensagem explica o porquê. Não fazer squash do histórico (exigência do enunciado). O usuário abre os PRs manualmente.
- Ao fim de cada etapa: atualizar `DIARIO.md` (incluindo onde a IA ajudou/errou), `TIMESHEET.md` e `todo.md` (gitignored, do usuário).
- `DECISIONS.md` tem limite de 3–8 entradas; a 8ª está reservada para a obrigatória "manteria o RabbitMQ?".
- Nada de segredo real no repo: credenciais no `.env` (gitignored, modelo em `.env.example`), chaves JWT em `secrets/` (gitignored, geradas por `scripts/gerar-chaves-jwt.sh`). Valores de teste devem ser claramente de teste (`senha-de-teste`, `@teste.local`).

## Comandos

```bash
cp .env.example .env && ./scripts/gerar-chaves-jwt.sh   # primeira vez
docker compose up --build --watch                       # sobe tudo com hot reload
docker compose up -d --build api                        # sem --watch, código novo só entra com rebuild
docker compose down -v                                  # apaga dados de MySQL/Mongo

docker compose exec api npm test                        # unitários (*.spec.ts), sem banco
docker compose exec api npm run test:integration        # *.int-spec.ts contra MySQL, banco corridas_test
docker compose exec api npm run test:e2e                # *.e2e-spec.ts
docker compose exec api npx vitest run src/rides/domain/ride.spec.ts -t "nome do teste"   # um teste
docker compose exec api npx vitest run --config vitest.config.integration.ts <arquivo>     # um de integração
docker compose exec api npm run lint                    # oxlint --type-aware
docker compose exec api npx tsc --noEmit
docker compose exec worker npm test                    # node:test, *.test.ts
docker compose exec worker npm run test:integration    # *.int-test.ts contra Redis (db 15) e Mongo (corridas_test)
docker compose exec worker node --test --test-name-pattern "nome" src/handle-message.test.ts   # um teste
docker compose exec worker sh -c 'npm run typecheck && npm run lint'
docker compose exec ui npm run lint
```

Integração: `test/integration/global-setup.ts` cria e migra `corridas_test`; `resetDatabase` recusa rodar fora de um banco `_test`; `fileParallelism: false` porque os arquivos dividem o banco.

Migrations: o container da api roda `prisma migrate deploy` + seed no start. Para gerar uma nova, ver README; quando o `migrate dev --create-only` pede confirmação (avisos de UNIQUE etc.) ele falha sem TTY — usar `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output prisma/migrations/<timestamp>_<nome>/migration.sql`.

## Arquitetura

**api/** — NestJS 12, ESM (imports relativos com `.js`), Vitest, oxlint, Prisma 7 com adapter mariadb. DDD por contexto (`identity`, `rides`), cada um com camadas `domain/` → `application/` → `infrastructure/` → `presentation/`. Contratos (repositórios, cache, hasher, issuer) são classes abstratas usadas direto como token de DI e ligadas à implementação no `*.module.ts`. Erros de domínio viram HTTP em filtros por contexto (`identity-error.filter.ts`, `rides-error.filter.ts`). Tabelas, colunas, rotas e chaves do snapshot ficam em português (mapeadas no `schema.prisma` e em `ride-snapshot.ts`).

- **Auth** (`identity`): login e-mail/senha (scrypt), access token JWT RS256 de 15 min, refresh token opaco (SHA-256 no banco, rotação com detecção de reuso) em cookie httpOnly `path=/auth`. `JwtAuthGuard` é exportado e usado por `rides`.
- **Corridas** (`rides`): passageiro cria/lê só as suas; motorista lê abertas + as dele e muda status em linha reta `solicitada → aceita → em_andamento → finalizada` (fora de ordem → 409). Um motorista tem no máximo uma corrida ativa: o aceite trava a linha do motorista (`SELECT ... FOR UPDATE`, READ COMMITTED). Toda transição usa lock otimista (`updateMany where { id, versao }`). `POST /corridas` exige `Idempotency-Key`: UNIQUE `(passageiro_id, chave)` + hash do corpo (mesma chave, outro corpo → 422).
- **Correlation** (`shared/correlation.ts`): middleware guarda o `X-Correlation-Id` (do cliente, se válido, ou gerado) num `AsyncLocalStorage`; o repositório grava na coluna `headers` do outbox e o relay repassa como headers AMQP, porque publica fora da requisição. O `traceparent` do OTel deve seguir o mesmo caminho.
- **Outbox** (`shared/outbox`): cada escrita grava o evento em `outbox_eventos` na mesma transação. `OutboxRelay` roda dentro da api (poll a cada 1s, `FOR UPDATE SKIP LOCKED`) e publica com publisher confirms no exchange topic `corridas`. Envelope: `{ eventId, type, occurredAt, data }`, `data` = snapshot da corrida com `versao`. Tipos em `rides/infrastructure/ride-events.ts`.
- **Cache**: `GET /corridas/:id` lê `corrida:<id>` no Redis e cai para o MySQL no miss ou erro. Só o worker escreve no cache; a api só lê.

**RabbitMQ** — topologia em `rabbitmq/definitions.json` (exchange `corridas`, fila quorum `worker.corridas` ligada a `corrida.*`, DLQ `worker.corridas.dlq`), aplicada via HTTP pelo serviço one-shot `rabbitmq-init`; api e worker dependem dele com `service_completed_successfully`. Não usar o import no boot do broker: com ele o usuário do `.env` não é criado.

**worker/** — Node 24 rodando TypeScript nativamente (type stripping: imports com `.ts`, sem enum nem parameter properties). Consome `worker.corridas` (prefetch 10) e, para cada mensagem, sempre faz as duas escritas, cada uma idempotente por si (sem "porteiro" por `eventId`, para uma reentrega completar o que faltou): histórico no Mongo via Mongoose (`historico_corridas`, `_id = eventId`, chave duplicada = já gravado) e snapshot no Redis por um Lua compare-and-set de `versao`. `handle-message.ts` decide `ack` / `dead-letter` (inválida → DLQ) / `retry` (espera 5s e requeue, para não esgotar o delivery-limit 20 da fila quorum). Sem reconexão: perdeu o RabbitMQ, `process.exit(1)` e o `restart: unless-stopped` sobe de novo — por isso o CMD é `node src/main.ts` sem `--watch` e o hot reload é `sync+restart` do compose watch. Logs: uma linha JSON por evento (`log.ts`), com `correlation_id`. O contrato do evento é uma cópia do da api (`ride-event.ts`).

**ui/** — Vite 8 + React 19, sem router nem lib de dados. `api.ts` é o único cliente HTTP: `fetch` com `credentials: 'include'` (CORS com credentials na api, origem em `CORS_ORIGIN`), access token só em memória e refresh reativo no 401 com **um refresh em voo por vez** — dois refresh simultâneos com o mesmo cookie disparam a detecção de reuso da api e revogam todas as sessões (o StrictMode roda o efeito de boot duas vezes). No boot a sessão volta por `POST /auth/refresh`. A lista faz polling de 5s com a aba visível. A `Idempotency-Key` é uma por intenção (ref renovado no `onChange` do form). Forms usam `onSubmit`, não form action, porque a action reseta o form e apagaria o que o usuário digitou num erro.

**Compose** — portas publicadas só em `127.0.0.1`. `mysql/initdb/` concede ao usuário da app o shadow database do Prisma e o banco `corridas_test` (só roda em volume novo). Mongo fixado em `mongo:9` porque o 8.x não sobe em kernel ≥ 6.19.
