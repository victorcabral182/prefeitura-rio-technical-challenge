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

**Total do dia:** 2h56min

---

## Resumo Geral

| Indicador                   | Valor     |
| --------------------------- | --------- |
| Tempo sugerido pelo desafio | 6–8 horas |
| Tempo total registrado      | 2h56min   |
| Tempo restante até 8h       | 5h04min   |
