# Limites

O que ficou de fora, os riscos conhecidos que continuam abertos e o que eu faria com mais tempo. Os detalhes de como cada ponto foi encontrado estão no [DIARIO.md](DIARIO.md).

## Fora do escopo, por decisão

- **KEDA (bônus da Parte 3).** Durante o k6 a fila nunca acumulou: pico de 32 mensagens, com o worker a 0,08 core. Uma demonstração de escala pela fila seria forçada. O caminho para fazer está em [`k8s/README.md`](k8s/README.md).
- **CI só em pull request para `develop` e `main`.** O enunciado pede "a cada push/PR". Escolhi rodar só em PR: o check aparece antes do merge, e push em branch sem PR não gasta execução. Um push direto em `main`, sem PR, não passa pelo CI.
- **Kubernetes mínimo:** um nó só, sem Ingress, HPA, PodDisruptionBudget, NetworkPolicy nem réplicas dos bancos. UI, Prometheus e Jaeger rodam só no compose.
- **Sem cancelamento nem expiração** de corrida não aceita.

## Riscos conhecidos

### Segurança

- **Conexões internas sem TLS nem autenticação completa.** A conexão com o MySQL usa `allowPublicKeyRetrieval=true` (aceitável na rede interna do compose; em produção, TLS). O Mongo e o Redis rodam sem senha.
- **`/metrics` da api é público**, na mesma porta da api. Em produção, iria para uma porta separada ou ficaria atrás de autenticação.
- **O access token não é revogável:** o logout revoga o refresh token, mas o access token vale até expirar (15 min). A rotação da chave do JWT exige redeploy, porque não há JWKS (DECISIONS.md, entrada 3).
- **O container de ferramentas do Kubernetes monta o `docker.sock`** e, com isso, tem controle total do Docker do host. É o mesmo poder que o kind precisa para criar o cluster, mas vale saber antes de rodar.

### Dados e mensageria

- **O outbox não é limpo:** as linhas publicadas ficam em `outbox_eventos` para sempre. O índice em `publicado_em` mantém o poll barato, mas a tabela cresce sem limite (~10 mil linhas por execução do k6).
- **Chaves `corrida:<id>` no Redis sem TTL:** o cache cresce com o total de corridas.
- **A DLQ não tem reprocessamento:** mensagem inválida fica em `worker.corridas.dlq` até alguém olhar.
- **Sem replay de eventos:** reconstruir o cache ou o histórico exigiria republicar a partir do MySQL (DECISIONS.md, entrada 8).
- **O atraso até o worker é o poll do relay:** p50 ~0,7 s e p95 ~1,6 s no teste de carga, quase todo vindo do intervalo de 1 s do outbox, não do worker.

### Resiliência

- **Com o MySQL fora, cada requisição leva ~10 s para falhar** (o timeout para pegar conexão do pool), sem circuit breaker. A api acumula requisições penduradas em vez de responder 503 rápido.
- **O worker não reconecta:** se perder o RabbitMQ, sai, e o compose ou o Kubernetes o sobem de novo (é o desenho). No boot do cluster ele reinicia algumas vezes até a fila existir.
- **Spans finais podem se perder no shutdown:** não há `sdk.shutdown()` do OpenTelemetry no SIGTERM. O Jaeger guarda tudo em memória e perde os traces ao reiniciar.

### Produto e UI

- **A listagem traz as 50 corridas mais recentes, sem paginação.** O motorista vê abertas e as dele numa lista só. Com mais de 50 corridas abertas mais novas, ele **deixa de ver a própria corrida ativa** na UI. Encontrei isso no e2e, depois do teste de carga. A correção é listar as dele separadas das abertas, com paginação por cursor.
- **Duas abas renovando o token no mesmo instante** podem disparar a detecção de reuso do refresh e derrubar as sessões do usuário. Só se resolve com coordenação entre abas (por exemplo, `BroadcastChannel`).
- **Um cookie de refresh por navegador:** dois usuários no mesmo navegador exigem sessões separadas (janela anônima).

### Observabilidade

- **Sem spans do Nest:** `@opentelemetry/instrumentation-nestjs-core` não suporta o Nest 12. Os spans vêm de HTTP, Express e Prisma.
- **Sem dashboards:** as consultas úteis estão no README, mas não há Grafana.

## O que eu faria com mais tempo

1. Separar no `GET /corridas` as corridas do motorista das abertas, com paginação por cursor (o UUID v7 é ordenado pelo tempo).
2. Fazer a api falhar rápido com o MySQL fora (timeout de pool menor e 503), e só então avaliar um circuit breaker.
3. Criar um job de limpeza do outbox e acionar o relay logo após o commit, deixando o poll só como rede de segurança.
4. Rodar um teste de carga por taxa de chegada (`ramping-arrival-rate`) para achar o limite real; o teste atual só mostra que ~82 req/s são atendidas com folga.
5. Reprocessar a DLQ com uma ferramenta simples (republicar após corrigir a causa).
6. Ativar o KEDA quando o processamento por mensagem ficar caro, e colocar o Prometheus no cluster.
