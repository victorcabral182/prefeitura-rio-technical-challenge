# Timesheet — Registro de Desenvolvimento

Registro cronológico das horas dedicadas ao desenvolvimento do desafio técnico da Prefeitura do Rio.

## 11/11/2026 — Quarta-feira

| Início | Término | Duração | Atividades realizadas                                                                                                                                                            |
| ------ | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11:00  |         | 30min   | Leitura, análise dos requisitos desenvolvimento do roadmap do desafio técnico.                                                                                                   |
| 11:17  | 11:35   | 18min   | Monorepo (api NestJS 12, worker Node 24, ui Vite + React) e docker-compose com MySQL, Redis, MongoDB e RabbitMQ; diagnóstico do Mongo 8 no kernel 7.0 e da CPU dos healthchecks. |
| 11:35  | 12:00   | 25min   | README (como rodar e declaração de uso de IA), DIARIO, roadmap, timesheet e commits.                                                                                             |
| 12:00  | 12:24   | 24min   | Credenciais do compose para .env (histórico da branch reescrito), revisão das decisões da etapa 1, DECISIONS.md e merge do PR #1 em develop.                                     |
| 12:24  | 12:30   | 6min    | Diagramação das telas de login (e-mail e senha), listagem e criação de corridas, sem integração com a API.                                                                       |
| 12:30  | 13:01   | 31min   | Banco da API: escolha do Prisma e do modelo (usuários com tipo, corridas, UUID), migration inicial aplicada no start da api, permissão de shadow database e fluxo de migrations. |
| 13:01  | 13:43   | 42min   | Arquitetura DDD da API e autenticação: login com JWT RS256, refresh token com rotação e detecção de reuso, scrypt, seed de usuários de teste, chaves via compose secrets e testes. |
| 14:41  | 15:27   | 46min   | API de corridas: perfis e 403, POST idempotente, PATCH de status com lock do motorista, GET com cache Redis, listagem, outbox + topologia do RabbitMQ (rabbitmq-init), testes unitários e de integração no MySQL, DECISIONS 4–7. |

**Total do dia:** 3h42min

## 12/11/2026 — Quinta-feira

| Início | Término | Duração | Atividades realizadas                                                                                                                                                            |
| ------ | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17:45  | 17:57   | 12min   | CLAUDE.md, CI no GitHub Actions (PRs para develop/main, comandos do README dentro do compose), simulação em ambiente limpo e correção da autenticação do driver mariadb no MySQL. |
| 17:59  | 18:16   | 17min   | Worker: correlation_id pelo outbox até os headers AMQP, consumo idempotente (Mongo `_id = eventId`, Lua compare-and-set por versão), DLQ/retry/restart, testes node:test e cenários de falha; DECISIONS 5 estendida. |
| 18:18  | 18:31   | 13min   | Integração da UI com a API: CORS com credentials, token em memória, refresh reativo com um refresh em voo, polling, Idempotency-Key por intenção; testes no Chrome (reload, 409, ciclo de status, expiração do token). |
| 18:33  | 19:18   | 45min   | Parte 2: logs JSON (pino), /metrics (prom-client) e Prometheus, tracing OTel até o Jaeger atravessando o outbox, dois alertas validados no CI, teste de carga k6 e relatório. |
| 20:13  | 20:23   | 10min   | Correção do deadlock intermitente do OutboxRelay no CI (gap lock do REPEATABLE READ no índice `publicado_em`): READ COMMITTED na transação do relay. |

**Total do dia:** 1h37min

---

## Resumo Geral

| Indicador                   | Valor     |
| --------------------------- | --------- |
| Tempo sugerido pelo desafio | 6–8 horas |
| Tempo total registrado      | 5h19min   |
| Tempo restante até 8h       | 2h41min   |
