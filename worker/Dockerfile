# Imagem de desenvolvimento: o código chega via `docker compose up --watch`.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Sem `node --watch`: ele segura o processo depois de um crash e impede o restart
# do compose. O hot reload em dev é o `sync+restart` do compose watch. Node direto
# (sem npm): só JSON no stdout, e o SIGTERM chega no handler do main.ts.
CMD ["node", "src/main.ts"]
