# Corridas — desafio técnico Prefeitura do Rio

Versão simplificada do fluxo do Taxi.Rio: API NestJS, worker Node, UI React, MySQL, Redis, MongoDB e RabbitMQ.

Decisões e trade-offs: [DECISIONS.md](DECISIONS.md) · diário de bordo: [DIARIO.md](DIARIO.md) · o que ficou de fora e riscos abertos: [LIMITES.md](LIMITES.md) · horas: [TIMESHEET.md](TIMESHEET.md).

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
| Jaeger (traces)   | http://localhost:16686                                                  |
| Prometheus        | http://localhost:9090 (alertas em `/alerts`)                            |

### UI

Em http://localhost:5173, entre com um dos usuários de teste abaixo. O passageiro cria corridas e acompanha o status; o motorista vê as abertas e aceita, inicia e finaliza. A lista se atualiza a cada 5s enquanto a aba está visível.

Para ver passageiro e motorista ao mesmo tempo, use duas janelas com sessões separadas (por exemplo uma normal e uma anônima): o cookie do refresh é um só por navegador, e duas abas na mesma sessão acabariam como o último usuário que entrou.

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

O worker consome `worker.corridas`, grava o snapshot no Redis (`corrida:<id>`, só se a `versao` for maior que a do cache) e um documento por evento na coleção `historico_corridas` do MongoDB (`_id = eventId`). Mensagem duplicada não muda nada, mensagem inválida vai para a `worker.corridas.dlq`, e com Redis ou Mongo fora a mensagem volta para a fila depois de 5s. Se perder o RabbitMQ, o worker sai e o compose o reinicia.

Toda resposta da api traz `X-Correlation-Id` (o enviado pelo cliente ou um gerado). Ele segue no outbox e nos headers da mensagem até os logs JSON do worker:

```bash
docker compose logs worker --no-log-prefix | grep <correlation-id>
```

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
docker compose exec api npm run test:e2e          # pela API HTTP, contra a stack de pé e os usuários do seed
docker compose exec api npm run lint
docker compose exec worker npm test                  # unitários
docker compose exec worker npm run test:integration  # contra Redis (db 15) e Mongo (banco corridas_test)
docker compose exec worker sh -c 'npm run typecheck && npm run lint'
docker compose exec ui npm run lint
```

O que cobrem:

- **Fluxo feliz**: `api/test/rides.e2e-spec.ts`, pela API HTTP. O passageiro cria a corrida, e o motorista aceita, inicia e finaliza.
- **Falhas**, no mesmo e2e: 401 sem token e com token adulterado, reenvio com a mesma `Idempotency-Key` devolvendo a mesma corrida, 403 do passageiro mudando status, 409 ao pular etapa.
- **Concorrência contra o MySQL real** (integração): POSTs simultâneos com a mesma chave, dois motoristas aceitando a mesma corrida, aceites simultâneos do mesmo motorista e dois relays do outbox ao mesmo tempo.
- **Worker**: mensagem duplicada, versão antiga chegando depois da nova, JSON inválido indo para a DLQ, Mongo ou Redis fora devolvendo a mensagem para a fila.

O CI (`.github/workflows/ci.yml`) roda esses mesmos comandos dentro das imagens do compose em todo PR para `develop` ou `main`, a partir de um `.env` copiado do `.env.example` e de chaves JWT geradas na hora.

Apagar os dados (MySQL/Mongo) e recomeçar: `docker compose down -v`.

### Observabilidade

- **Logs**: uma linha JSON por evento na api e no worker (`docker compose logs -f api worker`), com `correlation_id` e `trace_id`. O `correlation_id` vem do header `X-Correlation-Id` (enviado pelo cliente ou gerado pela api, e devolvido na resposta) e segue pelo outbox e pelo RabbitMQ até o worker.
- **Métricas**: `GET /metrics` na api (`:3000`) e no worker (`:9100`, só na rede do compose), além do plugin do RabbitMQ (tamanho da fila). O Prometheus raspa os três a cada 5s (`observability/prometheus.yml`). Exemplos: `rate(http_requests_total[1m])`, `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[1m])))`, `rabbitmq_detailed_queue_messages_ready`, `sum by (result) (rate(cache_lookups_total[1m]))` (hit/miss do cache), `histogram_quantile(0.95, sum by (le) (rate(worker_event_lag_seconds_bucket[1m])))`.
- **Traces**: OpenTelemetry na api e no worker, exportando para o Jaeger. Uma corrida aparece como um trace só: `POST /corridas` → transação no MySQL → publish do relay → consumo no worker → Mongo e Redis. Para achar o trace de uma requisição, pegue o `X-Correlation-Id` da resposta, procure-o nos logs (`docker compose logs api worker | grep <id>`) e abra o `trace_id` da linha em http://localhost:16686/trace/<trace_id>. O Jaeger guarda tudo em memória.
- **Alertas**: `observability/alerts.yml` (carregado pelo Prometheus do compose) e `observability/alerts-prometheusrule.yaml` (o mesmo conteúdo como `PrometheusRule` para o cluster). O CI valida as regras com `promtool` e falha se os `groups` dos dois arquivos divergirem. A justificativa de cada alerta está nos comentários do arquivo.

### Teste de carga

```bash
docker compose run --rm k6   # ~4 min, com a stack de pé
```

O serviço `k6` fica fora do `up` normal (profile `loadtest`). Ele roda `loadtest/corridas.js`, que sobe até 50 passageiros criando e lendo corridas, e grava o resumo em `loadtest/resultado.json`. Cenário, números e achados: [`loadtest/RELATORIO.md`](loadtest/RELATORIO.md).

### Kubernetes

```bash
./scripts/k8s.sh up        # cluster kind local com api (2 réplicas), worker e infra; ~2 min
curl localhost:8080/health
./scripts/k8s.sh down
```

Só precisa de Docker: kind e kubectl rodam num container. Também usa o `.env` e as chaves de `secrets/`, que viram Secrets do cluster sem passar pelo git. Probes, requests/limits (medidos durante o k6) e o que ficou de fora: [`k8s/README.md`](k8s/README.md).

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
| `worker/` | Node 24 + TypeScript executado nativamente (sem build), `node:test` |
| `ui/`     | Vite 8 + React 19                                           |

Cada pasta é um pacote npm independente, com seu próprio `package-lock.json` e `Dockerfile`.

## Uso de IA

Desenvolvido em par com o **Claude Code** (Anthropic), usado no projeto inteiro: scaffold, implementação, testes, diagnóstico de falhas e rascunho da documentação. As decisões técnicas foram minhas: a IA apresentava as alternativas com os trade-offs, e eu escolhia. A exceção foi a Parte 3 (Kubernetes), em que não tenho experiência e deleguei as escolhas, pedindo que cada uma ficasse explicada em [`k8s/README.md`](k8s/README.md). O [`CLAUDE.md`](CLAUDE.md) é o contexto que a IA recebia a cada sessão, e o [DIARIO.md](DIARIO.md) registra onde ela ajudou e onde errou.

Sugestões que corrigimos porque a medição ou o teste contradisse:

- **Limite de memória do RabbitMQ no cluster.** A IA escreveu que o broker calcula o alarme de memória pelo limit do container. Medido no pod, o alarme saía da RAM do host (~10 GB), e o container seria morto por OOM antes de frear os publishers. Foi corrigido informando o limit explicitamente.
- **Tokens no resultado do k6.** A primeira versão do script logava no `setup()`, e o `--summary-export` grava o retorno dele: os access tokens iriam para o `resultado.json` versionado. O login passou para cada VU.
- **`mongo:8`** não sobe em kernel ≥ 6.19 (SERVER-121912). Trocado por `mongo:9` depois de testar as duas imagens.
