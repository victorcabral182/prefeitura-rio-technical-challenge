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

## 3. JWT RS256 validado por chave pública, sem JWKS

**Contexto.** O enunciado pede rotas protegidas por JWT (sem token ou token inválido → 401) e permite usar um token pré-gerado. A tela de login pede e-mail e senha, então a própria API emite o token. Hoje só a API valida tokens; o worker consome da fila e não recebe requisições de usuário.

**Alternativas.**

- **HS256 (segredo compartilhado):** uma chave só, que assina e valida.
- **RS256 com chave pública:** a API assina com a chave privada e valida com a pública, as duas lidas de arquivo.
- **RS256 com JWKS:** a chave pública é publicada num endpoint (`/.well-known/jwks.json`) com `kid`, e quem valida a busca de lá.

**Escolha.** RS256 com chave pública. Quem só precisa validar recebe a chave pública e não consegue emitir tokens. Com HS256, qualquer serviço que valida também poderia forjar. O JWKS resolve um problema que ainda não existe: descobrir e rotacionar chaves entre vários consumidores. As chaves são arquivos em `secrets/`, fora do git, gerados por `scripts/gerar-chaves-jwt.sh` e montados como compose secrets (no Kubernetes, um Secret). A validação fixa `algorithms: ['RS256']`, `issuer` e `audience`, então um token com `alg: none` ou HS256 é recusado.

**Trade-off aceito.** Para trocar a chave, é preciso reiniciar a API, e todos os access tokens emitidos com a chave antiga caem na hora. O impacto é pequeno: o refresh token é opaco e não depende da chave, então o cliente recebe um 401, renova a sessão e segue, sem novo login. Se aparecer outro serviço validando tokens, ou se a rotação precisar ser feita sem derrubar sessões, a evolução é publicar um JWKS com `kid` e manter as duas chaves válidas durante a troca.
