# Diário de bordo

Registro cronológico e informal. Desenvolvido em par com Claude Code (ver declaração de IA no README).

## 2026-11-11

- Scaffold da API com `nest new`: veio NestJS 12, já ESM, com Vitest e oxlint (esperava CommonJS + Jest + ESLint). Imports relativos terminam em `.js`. Sigo o padrão do framework.
- Scaffold da UI com `create-vite`: Vite 8, React 19, TypeScript 7, oxlint.
- Monorepo sem npm workspaces: cada serviço tem o próprio lockfile e builda com a própria pasta como contexto. Com workspaces, todo build Docker precisaria do lockfile da raiz. Custo aceito: o contrato dos eventos vai ser duplicado entre api e worker.
- Worker em Node puro, sem Nest: é um consumidor de fila, sem rotas nem DI. O Node 24 roda `.ts` direto (type stripping), então não tem build e o `tsc` fica só para typecheck. Testei num `node:24-alpine` antes: roda sem warning.
- Dev 100% em Docker com `docker compose up --watch`: sincroniza `src/` para o container e rebuilda quando o `package.json` muda. Descartei bind mount por dois motivos: o `node_modules` em volume anônimo fica desatualizado e o `dist/` criado como root aparece no host. Medi o hot reload: ~1–1,6s na api, no worker e na ui.
- `.dockerignore` com `node_modules`: evita que o `COPY . .` leve para a imagem Alpine (musl) o `node_modules` do host (glibc), com binários nativos incompatíveis.
- **Mongo não subia** (exit 1): `MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB` (SERVER-121912). Meu kernel é 7.0. Testei as imagens: a `mongo:8` (hoje 8.3.13) recusa até `mongod --version` e a `mongo:9` (9.0.4) sobe. Segundo o Jira, todo o 8.0+ é afetado: o TCMalloc viola a ABI do `rseq` e o kernel 6.19 expôs isso. Fui de `mongo:9`.
- Healthcheck do MySQL via TCP (`-h 127.0.0.1`): no primeiro boot o entrypoint sobe um servidor temporário com `--skip-networking` (conferi no `docker-entrypoint.sh`), e um ping por socket daria healthy antes da hora.
- RabbitMQ: o `guest` só conecta de localhost, então criei um usuário de dev. Hostname fixo porque os dados ficam no nome do nó (`rabbit@<hostname>`).
- **RabbitMQ a 46% de CPU parado** no `docker stats`. Amostrei de 2 em 2s: base de ~0,2% com picos de 172% a cada ~10s, que era o intervalo do healthcheck. O `rabbitmq-diagnostics` sobe uma VM Erlang a cada execução (~0,9s), e o `mongosh` também pesa (~0,6s). Mudei os healthchecks para checar a cada 2s no boot (`start_interval`) e a cada 30s depois. No compose o healthcheck só segura o `depends_on`. O boot do zero caiu de 12,3s para 9,8s, e esses picos não vão poluir o k6.
- Testei o tempo de parada dos containers (Node como PID 1 ignora SIGTERM sem handler): <0,4s nos três, porque o npm repassa o sinal. `init: true` não foi necessário.
