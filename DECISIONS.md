# Decisões

Cada entrada traz o contexto, as alternativas consideradas, a escolha e o trade-off aceito.

## 1. Monorepo com pacotes independentes, sem npm workspaces

**Contexto.** O enunciado pede `api/`, `worker/` e `ui/` no mesmo repositório, cada um com sua imagem Docker. API e worker vão compartilhar o contrato dos eventos (`corrida.criada`, `corrida.status_alterado`).

**Alternativas.**

- **npm workspaces:** um lockfile na raiz e um pacote compartilhado com os tipos dos eventos.
- **Pacotes independentes:** cada pasta com seu `package.json`, `package-lock.json` e `Dockerfile`.

**Escolha.** Pacotes independentes. Cada imagem builda só com a própria pasta como contexto (`build: ./api`), então o Dockerfile fica simples e o cache do `npm ci` só invalida quando as dependências daquele serviço mudam. Com workspaces, todo build precisaria do contexto da raiz e do lockfile único, e qualquer dependência nova em um serviço invalidaria o cache dos outros.

**Trade-off aceito.** O contrato dos eventos fica duplicado entre api e worker, e uma mudança no payload precisa ser feita nos dois lados. Com dois eventos pequenos, o custo é baixo; se o número de contratos crescer, a saída seria extrair um pacote compartilhado ou adotar um schema (JSON Schema/AsyncAPI).

## 2. Worker em Node puro, sem NestJS

**Contexto.** O worker consome eventos do RabbitMQ, atualiza o cache no Redis e grava o histórico no MongoDB. Não expõe rotas de negócio, só `/health` e, depois, `/metrics`.

**Alternativas.**

- **NestJS com `@nestjs/microservices`:** mesmo framework da API, com transport RabbitMQ.
- **Node puro:** um consumidor com o client do RabbitMQ e um servidor HTTP mínimo do `node:http`.

**Escolha.** Node puro. Um consumidor de fila não precisa de roteamento, injeção de dependência nem módulos; o fluxo cabe em poucas funções e fica fácil de explicar linha a linha. O Node 24 executa TypeScript direto (type stripping), então não há etapa de build: o `tsc` roda só como typecheck.

**Trade-off aceito.** Os dois serviços Node têm estilos diferentes, e coisas que o Nest daria prontas (ack/retry do transport, integração de logs e métricas) precisam ser escritas à mão. Também fico com controle explícito do ack, do prefetch e da DLQ, que é justamente o que preciso para garantir a idempotência no consumo at-least-once.
