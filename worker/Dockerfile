# Imagem de desenvolvimento: o código chega via `docker compose up --watch`.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]
