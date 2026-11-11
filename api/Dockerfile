# Imagem de desenvolvimento: o código chega via `docker compose up --watch`.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
# Aplica só as migrations pendentes (idempotente) antes de subir o Nest.
# `exec` deixa o npm como processo principal, para o SIGTERM do `docker stop` chegar nele.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm run start:dev"]
