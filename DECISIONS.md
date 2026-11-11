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

## 4. Idempotência do `POST /corridas` no banco e na aplicação

**Contexto.** Reenviar o mesmo `POST /corridas` com a mesma `Idempotency-Key` não pode criar outra corrida. O caso real é o cliente que não recebeu a resposta (timeout, rede móvel) e tenta de novo, às vezes duas vezes ao mesmo tempo.

**Alternativas.**

- **Só na aplicação:** procurar a chave antes de inserir. Dois POSTs simultâneos passam juntos pela procura e duplicam.
- **Só no banco:** UNIQUE na chave e converter a violação em resposta. Funciona, mas todo reenvio vira uma tentativa de insert com erro.
- **Redis (`SET NX` com TTL):** rápido, mas não é atômico com o insert no MySQL: se a API cair entre os dois, a chave fica travada ou a corrida duplica.
- **Tabela de idempotência genérica:** serve para qualquer rota, com a resposta salva. É mais código do que uma rota só justifica.

**Escolha.** As duas camadas, nas colunas da própria `corridas`: `chave_idempotencia` com `UNIQUE (passageiro_id, chave_idempotencia)` e `hash_idempotencia` (SHA-256 de origem e destino). A aplicação procura a chave primeiro e resolve o reenvio comum sem tentar inserir. A UNIQUE resolve a corrida entre requisições simultâneas: quem perde recebe a corrida de quem ganhou. A chave é única por passageiro, então duas pessoas podem usar o mesmo valor. O cabeçalho é obrigatório (400 sem ele). Reenvio igual responde 201 com a mesma corrida. A mesma chave com outro corpo responde 422, porque o cliente reaproveitou a chave por engano. É o comportamento do draft do IETF `Idempotency-Key` e da API do Stripe. Testei 10 POSTs simultâneos com a mesma chave: 10 respostas 201 e uma corrida no banco.

**Trade-off aceito.** A chave não expira e fica guardada para sempre junto da corrida. Um cliente que reutilize chaves ao longo do tempo (em vez de UUID por requisição) recebe 422. Se a idempotência for necessária em outras rotas, a evolução é a tabela genérica.

## 5. Entrega de eventos: outbox transacional, topic exchange e fila quorum

**Contexto.** A cada criação ou mudança de status, a API publica `corrida.criada` ou `corrida.status_alterado` para o worker atualizar o cache e o histórico. Gravar no MySQL e publicar no RabbitMQ são duas operações sem transação comum: a API pode gravar e cair antes de publicar (evento perdido) ou publicar e falhar no commit (evento de algo que não existe).

**Alternativas.**

- **Publicar direto após o commit:** simples, mas perde o evento se o broker estiver fora ou a API cair entre o commit e o publish.
- **Outbox transacional:** o evento vai para uma tabela na mesma transação da escrita, e um relay publica depois.
- Para a **topologia:** fanout (sem filtro por tipo), topic com uma fila por evento (eventos da mesma corrida fora de ordem) ou topic com uma fila só.
- Para **criar a topologia:** cada serviço declarar ao conectar (duplicação), importar no boot do RabbitMQ ou importar depois do boot.

**Escolha.**

- **Outbox:** tabela `outbox_eventos`. Um relay dentro da API lê a cada segundo, com `FOR UPDATE SKIP LOCKED` (várias réplicas não pegam o mesmo lote), publica com publisher confirms e só então marca como publicado.
- **Envelope:** `{ eventId, type, occurredAt, data }`, com `data` sendo o snapshot completo da corrida mais um campo `versao` incrementado a cada mudança. O worker deduplica pelo `eventId`, grava o cache sem consultar o MySQL e descarta evento com versão menor que a do cache.
- **Topologia:** exchange `corridas` (topic) e uma fila `worker.corridas` ligada a `corrida.*`. Numa fila só, os eventos de uma corrida chegam em ordem, e um consumidor novo cria a própria fila sem mudar a API. As filas são quorum, o tipo recomendado pelo RabbitMQ para filas duráveis: depois do limite de reentregas, a mensagem que sempre falha vai sozinha para `worker.corridas.dlq`.
- **Onde fica a topologia:** num arquivo só, `rabbitmq/definitions.json`, aplicado pelo serviço `rabbitmq-init` (`POST /api/definitions`) antes de api e worker subirem. Mensagem publicada numa exchange sem fila ligada é descartada em silêncio, por isso nada publica antes de a fila existir.
- **Por que não o import no boot:** tentei primeiro, mas com ele o broker deixa de criar o usuário do `.env` (`Will not seed default virtual host and user: have definitions to load`).

**Trade-off aceito.**

- A entrega é at-least-once. Se a API cair entre o confirm e o commit, o lote é publicado de novo, e o worker precisa ser idempotente, coisa que o enunciado já exige.
- O evento atrasa até ~1s por causa do polling.
- O relay segura uma transação aberta enquanto publica (no máximo 100 eventos por lote).
- A tabela de outbox cresce sem limpeza. Apagar eventos publicados há mais de N dias fica para depois.

## 6. Cache do `GET /corridas/:id`: só o worker escreve

**Contexto.** `GET /corridas/:id` lê do Redis, e o enunciado põe o worker atualizando o cache a partir dos eventos. Falta decidir o que a API faz quando a corrida não está no cache.

**Alternativas.**

- **Cache-aside na API e no worker:** no miss a API lê o MySQL e grava no Redis. Mas a API pode gravar um status lido antes de uma mudança por cima do status novo que o worker acabou de escrever.
- **Write-through na API:** a API grava no MySQL e no Redis na mesma requisição. Contraria o fluxo do enunciado e diverge se o Redis falhar depois do MySQL.
- **Só o worker escreve; no miss a API lê o MySQL sem gravar.**

**Escolha.** Só o worker escreve, com a chave `corrida:<id>` e o mesmo snapshot dos eventos. Com um escritor só, não há corrida de escrita, e a `versao` do evento cobre réplicas do worker processando fora de ordem. No miss (corrida recém-criada, worker atrasado ou Redis fora), a API responde do MySQL. O cliente Redis roda sem fila offline: com o Redis fora, o comando falha na hora e a leitura cai no MySQL em vez de esperar a reconexão. Testei parando o Redis: a resposta veio do MySQL em 4ms. A regra de perfil vale também para o que vem do cache (outro passageiro recebe 403 com a corrida no cache).

**Trade-off aceito.** Logo depois de uma mudança, o cache pode ficar até ~1s (o polling do outbox) mais o tempo do worker atrás do MySQL. O `GET` aceita essa defasagem, e o `PATCH` sempre lê do MySQL antes de mudar o status. Se o worker parar, toda leitura vai ao MySQL, e a métrica de hit do cache (Parte 2) é o sinal para isso.

## 7. Interpretação dos perfis e listagem de corridas

**Contexto.** O enunciado diz "passageiro só cria/lê as próprias corridas; motorista só altera status". Ao pé da letra, o motorista não leria nenhuma corrida e não teria como saber qual aceitar. A UI também pede uma tela de listagem, mas o enunciado não tem rota de listagem.

**Alternativas.**

- **Motorista altera qualquer corrida:** literal, mas um motorista finalizaria a corrida de outro.
- **Motorista não lê:** literal ao extremo, inviabiliza a tela do motorista.
- **Motorista lê as abertas e as dele, e só o motorista atribuído avança a corrida.**

**Escolha.** A terceira, com estas regras:

- **Passageiro:** cria corridas e lê só as próprias. Em `PATCH`, ou lendo corrida de outro, recebe 403.
- **Motorista:** não cria (403). Lê as corridas `solicitada` e as que aceitou. Ao aceitar, vira o motorista da corrida, e só ele inicia e finaliza.
- **Ordem do status:** `solicitada → aceita → em_andamento → finalizada`, sem pular nem voltar (409).
- **Uma corrida ativa por motorista:** um motorista não pode aceitar outra corrida enquanto tiver uma `aceita` ou `em_andamento` (409). Dois aceites simultâneos dele passam pela mesma linha travada com `SELECT ... FOR UPDATE` em `usuarios`, um de cada vez. Testei quatro aceites simultâneos em duas corridas: um 200 e três 409. Toda mudança é um `UPDATE` condicional na `versao`, então duas mudanças simultâneas na mesma corrida (por exemplo, dois motoristas aceitando) também resultam em um 200 e um 409. Os dois casos têm teste de integração contra o MySQL (`prisma-ride.repository.int-spec.ts`), e cada um falha quando a proteção correspondente é removida.
- **Onde moram as regras:** na entidade `Ride` e nos casos de uso, não no controller.
- **Listagem:** a rota extra `GET /corridas` aplica a mesma visibilidade e devolve as 50 mais recentes, sem paginação.

**Trade-off aceito.**

- Não há cancelamento nem expiração de corrida não aceita. O `FOR UPDATE` usa uma linha de SQL cru, porque o Prisma não tem API de lock.
- A regra de visibilidade existe duas vezes: na entidade, para `GET /:id`, e no `WHERE` da listagem. A alternativa seria trazer tudo e filtrar em memória.
- Com mais de 50 corridas, as antigas somem da lista. A evolução é paginação por cursor pelo id (UUID v7 é ordenado pelo tempo).
