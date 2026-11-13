# Teste de carga — fluxo do passageiro

Script: `loadtest/corridas.js`. Resumo bruto do k6: `loadtest/resultado.json`.

```bash
docker compose up -d --build           # stack de pé
docker compose run --rm k6             # ~4 min
```

## Cenário

- Cada VU loga uma vez (passageiros do seed) e repete: `POST /corridas` com `Idempotency-Key` nova → `GET /corridas/:id` da corrida criada → 1 s de pausa.
- Rampa de 30 s até 50 VUs, 3 min em 50, 30 s descendo. Isso dá ~41 corridas/s e ~82 req/s no total.
- Thresholds: menos de 1% de erro, p95 do POST < 500 ms, p95 do GET < 200 ms.
- Ambiente: tudo no mesmo notebook (Ryzen 5 1600, 12 threads, 16 GB). O k6 divide CPU com a stack, então os números valem como ordem de grandeza, não como capacidade de produção.

O lado do cliente vem do k6. O lado do servidor vem do Prometheus, consultado no intervalo do teste (máximo de cada série em janelas de 30 s).

## Resultado (3ª execução, 12/11/2026)

| Métrica | Valor |
|---|---|
| Requisições | 19.722, 0 falhas, 100% dos checks |
| Vazão | ~82 req/s (pico de 96 req/s no Prometheus) |
| `POST /corridas` | p50 52 ms · p95 109 ms · máx. 180 ms |
| `GET /corridas/:id` | p50 11 ms · p95 49 ms · máx. 106 ms |
| 5xx | 0 |
| Fila `worker.corridas` (ready) | pico de 32, zera em segundos |
| Worker | ~49 msg/s, processamento p95 13 ms, 0 retry |
| Lag evento → worker | p50 ~0,7 s · p95 ~1,6 s |
| CPU | api até 0,98 core (pico no login inicial, scrypt) · worker 0,06 core |
| Event loop p99 | api 22 ms · worker 13 ms |

As duas execuções anteriores (ajustes no script) deram números equivalentes: p95 do POST entre 101 e 119 ms, sem erros.

## Achados

1. **Folga grande.** Com 50 VUs nenhum componente se aproximou do limite: api abaixo de 1 core, worker ocioso, fila sem acumular. O teste mostra que esse volume é atendido, mas não mostra onde a stack quebra. Para achar o joelho da curva seria preciso um cenário com executor `ramping-arrival-rate` subindo a taxa até o p95 estourar.
2. **O lag do worker é o intervalo de poll do outbox.** O p50 de ~0,7 s e o p95 de ~1,6 s vêm quase todo do `OutboxRelay` (poll de 1 s), não do worker, que processa em ~13 ms. A fila também chega em rajadas (picos de 30–40 mensagens) porque o relay publica em lotes. Se o atraso importar, as alavancas são reduzir o intervalo ou acordar o relay logo após o commit.
3. **O GET logo após o POST quase sempre cai no MySQL.** O cache só é preenchido pelo worker, ~1 s depois. Neste cenário o `GET /corridas/:id` mede o caminho de miss, Redis + MySQL, e o MySQL segura bem (p95 49 ms). Num uso real (motorista e passageiro consultando ao longo da corrida) a taxa de acerto do cache seria maior. Depois deste teste, a api ganhou a métrica `cache_lookups_total{result}`, que mostra essa taxa direto.
4. **O outbox cresce sem limite.** Cada execução cria ~10 mil corridas e ~10 mil linhas em `outbox_eventos`. As linhas publicadas ficam lá, só marcadas com `publicado_em`. O índice em `publicado_em` mantém o poll barato, mas a tabela precisa de uma rotina de limpeza.
5. **Limiares dos alertas.** `FilaWorkerAcumulando` (> 100 ready por 5 min) ficou longe de disparar, com pico de 32 que zera em segundos, e continua separando rajada normal de backlog real. `ApiErros5xx` não teve o que medir (0 erros). Nada a recalibrar.

## O que mudaria

- Cenário de stress por taxa de chegada para achar o limite (provavelmente o pool de conexões do MySQL ou a CPU da api).
- Relay acionado logo após o commit, com o poll ficando só como rede de segurança.
- Job de limpeza do outbox (apagar linhas publicadas há mais de N dias).
