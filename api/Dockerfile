# Estágio dev: o do compose, com o código chegando via `docker compose up --watch`.
# Estágio prod: o do Kubernetes, com o build pronto (ver o fim do arquivo).
FROM node:24-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
# Aplica só as migrations pendentes e cria os usuários de teste que faltam (ambos
# idempotentes) antes de subir o Nest.
# `exec` deixa o npm como processo principal, para o SIGTERM do `docker stop` chegar nele.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && exec npm run start:dev"]

# Kubernetes: código compilado, sem watch. Migrations e seed rodam num
# initContainer do Deployment (k8s/api.yaml), não aqui: assim a liveness probe
# não conta o tempo das migrations. Leva as devDependencies junto porque o
# initContainer usa o prisma CLI e o tsx da mesma imagem.
# ponytail: imagem maior que o necessário; separar uma imagem só de migrations se o tamanho importar.
FROM dev AS prod
RUN npm run build
CMD ["node", "--import", "./dist/instrumentation.js", "dist/main"]
