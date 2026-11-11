# Imagem de desenvolvimento: o código chega via `docker compose up --watch`.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# --host: o Vite escuta só em localhost por padrão, o que é inacessível de fora do container.
CMD ["npm", "run", "dev", "--", "--host"]
