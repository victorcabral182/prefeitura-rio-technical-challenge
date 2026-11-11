#!/bin/sh
# Gera o par RSA do JWT em secrets/ (fora do git). Roda num container Node para
# não depender de openssl/node no host; o arquivo sai com o seu usuário.
set -eu
cd "$(dirname "$0")/.."
mkdir -p secrets
if [ -f secrets/jwt_private.pem ]; then
  echo "secrets/jwt_private.pem já existe; apague-o para gerar outro par." >&2
  exit 1
fi
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/secrets:/out" -w /out node:24-alpine node -e '
const { generateKeyPairSync } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
writeFileSync("jwt_private.pem", privateKey, { mode: 0o600 });
writeFileSync("jwt_public.pem", publicKey);
'
echo "Chaves geradas em secrets/."
