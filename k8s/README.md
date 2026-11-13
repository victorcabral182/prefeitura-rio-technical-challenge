# Kubernetes (cluster local com kind)

```bash
./scripts/k8s.sh up                       # cria o cluster e sobe tudo (~2 min na 1ª vez)
curl localhost:8080/health                # api no cluster
./scripts/k8s.sh kubectl get pods         # qualquer comando kubectl (namespace corridas)
./scripts/k8s.sh kubectl logs deploy/worker
./scripts/k8s.sh down                     # apaga o cluster e os dados
```

Os pré-requisitos são os mesmos do compose: `.env` e as chaves de `scripts/gerar-chaves-jwt.sh`. Não é preciso instalar kind nem kubectl: o script builda um container com os dois (`k8s/tools/Dockerfile`, versões fixas com checksum conferido) e o roda com o socket do Docker do host. Isso dá a esse container controle total do Docker, o mesmo poder que o kind já precisa para criar o cluster.

O compose e o cluster podem rodar ao mesmo tempo: a api do cluster fica em `localhost:8080`, e a do compose em `localhost:3000`.

## O que sobe

| Recurso | Tipo | Por quê |
|---|---|---|
| api | Deployment, 2 réplicas, Service NodePort | Duas réplicas exercitam o relay do outbox em paralelo (`FOR UPDATE SKIP LOCKED`). O NodePort 30080 é publicado pelo kind em `127.0.0.1:8080`. |
| worker | Deployment, 1 réplica | Sem Service: não recebe tráfego, só consome a fila. |
| MySQL, MongoDB, RabbitMQ | StatefulSet com volume | Os dados sobrevivem ao pod ser recriado. O RabbitMQ precisa ainda de um hostname fixo (`rabbitmq-0`), porque guarda os dados pelo nome do nó. |
| Redis | Deployment sem volume | É só cache: o worker o preenche de novo a partir dos eventos. |
| rabbitmq-init | Job | Aplica `rabbitmq/definitions.json`, como o serviço de mesmo nome no compose. |

As migrations e o seed rodam num **initContainer** da api, antes do container principal. Assim o tempo das migrations não conta nas probes. Com duas réplicas os dois initContainers rodam juntos, e isso é seguro: o `prisma migrate deploy` usa um lock no banco, e o seed ignora o usuário que a outra réplica acabou de criar.

A imagem da api usa o estágio `prod` do `api/Dockerfile` (código compilado, sem watch). O compose continua no estágio `dev`.

Não sobem no cluster: a UI, o Prometheus e o Jaeger. A observabilidade fica no compose, e o SDK do OpenTelemetry é desligado no cluster (`OTEL_SDK_DISABLED`) para não tentar exportar para um Jaeger que não existe.

## Configuração e segredos

- **ConfigMap `config`**: o que não é segredo (URLs do Redis e do Mongo, caminho das chaves, `CORS_ORIGIN`).
- **Secret `credenciais`**: gerado pelo Kustomize a partir do `.env`, que não está no git.
- **Secret `jwt`**: gerado a partir de `secrets/*.pem`, também fora do git. Entra montado como arquivo, como os secrets do compose.

O repositório não tem nenhuma credencial; o cluster recebe as mesmas do compose. Cada container recebe só as chaves que usa (`secretKeyRef`), não o Secret inteiro. `DATABASE_URL` e `RABBITMQ_URL` são montadas pelo próprio Kubernetes a partir dessas chaves (`$(MYSQL_USER)` etc.).

O Kustomize põe um hash do conteúdo no nome do ConfigMap e do Secret gerados: mudar o `.env` muda o nome, e os pods que o usam são recriados com o valor novo.

## Probes

| Container | Probe | Configuração | Motivo |
|---|---|---|---|
| api | startup | `GET /health`, a cada 2s, até 30 falhas (60s) | Dá tempo para o Nest subir. Enquanto não passa, as outras probes não rodam. |
| api | liveness | `GET /health`, a cada 10s, 3 falhas | 30s sem responder = processo travado: reinicia. |
| api | readiness | `GET /health`, a cada 5s, 2 falhas | Em 10s a réplica sai do Service e deixa de receber tráfego. |
| worker | liveness | `GET /health` na 9100, a cada 10s, 3 falhas | Sem readiness: ele não recebe tráfego de Service, então ela não teria efeito. Se perder o RabbitMQ, o worker sai sozinho, e o Kubernetes sobe de novo. |
| MySQL, Mongo, Redis, RabbitMQ | readiness | TCP na porta do serviço | É barato. `mongosh` e `rabbitmq-diagnostics` custam ~1s de CPU por execução. No MySQL, a porta só abre quando o servidor real está pronto. |

O `/health` da api não consulta MySQL, Redis nem RabbitMQ, de propósito. Se o MySQL cair, todas as réplicas falhariam a probe ao mesmo tempo: o Kubernetes tiraria todas do Service (ou as reiniciaria em loop) e derrubaria também o que ainda funciona sem o MySQL, como o `GET /corridas/:id` pelo cache.

No boot, o worker reinicia algumas vezes até o RabbitMQ subir e o Job criar a fila. É o desenho do worker (sem reconexão; quem reinicia é a plataforma), e se resolve sozinho em menos de um minuto.

## Requests e limits

Medidos no próprio cluster, durante o teste de carga do `loadtest/` (50 VUs, ~82 req/s, 4 min). O k6 rodou na rede do kind contra o NodePort, e a CPU e a memória foram lidas do cgroup de cada container a cada 10s.

| Container | CPU média / máx. | Memória máx. | request | limit |
|---|---|---|---|---|
| api (por réplica) | 0,27 / 0,76 core | 272 MiB (pico 400 MiB) | 250m / 256Mi | 1 / 512Mi |
| worker | 0,05 / 0,08 core | 108 MiB | 100m / 128Mi | 500m / 256Mi |
| MySQL | 0,19 / 0,25 core | 584 MiB | 250m / 512Mi | 1 / 1Gi |
| MongoDB | 0,03 core | 141 MiB | 100m / 256Mi | 1 / 1Gi |
| RabbitMQ | 0,02 core | 141 MiB | 100m / 256Mi | 1 / 1Gi |
| Redis | 0,01 core | 16 MiB | 50m / 64Mi | 500m / 256Mi |

Como cheguei nos valores:

- **request ≈ o uso normal medido.** O scheduler usa o request para decidir em que nó o pod cabe, então ele deve refletir o consumo real em carga.
- **limit de memória com folga sobre o pico** (1,3× na api, ~1,7× no MySQL). Passar do limit de memória mata o container (OOMKilled), então a folga precisa ser real.
- **limit de CPU acima do pico.** Passar do limit de CPU não mata, só desacelera (throttling). Na api o pico vem do scrypt no login (~400 ms de CPU por hash), por isso 1 core.
- **Mongo e RabbitMQ com limit de 1Gi**, mesmo usando ~140 MiB. Os dois se dimensionam pela memória disponível. O Mongo lê o limit do container (conferido: `memLimitMB` 1024, cache do WiredTiger de 256 MB, o mínimo). O RabbitMQ não lê: no cluster ele calculou o alarme de memória sobre a RAM do host (0,6 × 16 GB ≈ 10 GB), e o container seria morto por OOM antes de o broker frear os publishers. Por isso `k8s/kustomization.yaml` informa o limit a ele (`total_memory_available_override_value`), e o alarme fica em ~600 MB. Um limit menor deixaria os dois sem folga.

São valores para este volume de carga num notebook. Em produção, a medição se repete com o tráfego real. Os valores da api também mudam se o número de réplicas mudar.

## O que ficou de fora

- **KEDA** (bônus). Durante o k6, o worker processou ~49 msg/s com 0,08 core, e a fila nunca acumulou: pico de 32 mensagens, zerando em segundos. Escalar pelo tamanho da fila só apareceria numa demonstração forçada, com o worker artificialmente lento. O caminho seria um `ScaledObject` com o scaler `rabbitmq` em modo `QueueLength` sobre `worker.corridas`, com o `TriggerAuthentication` lendo as credenciais do mesmo Secret. Faz sentido quando o processamento por mensagem ficar caro (por exemplo, uma chamada externa).
- **Ingress**, HPA, PodDisruptionBudget, NetworkPolicy e réplicas dos bancos: o cluster é de um nó só, para avaliação local.
