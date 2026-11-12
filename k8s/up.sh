#!/bin/sh
# Roda dentro do container de ferramentas (chamado pelo scripts/k8s.sh up).
set -eu
CLUSTER=corridas

kind get clusters | grep -qx "$CLUSTER" || kind create cluster --name "$CLUSTER" --config k8s/kind.yaml
# Este container entra na rede do kind para falar com o apiserver pelo nome
# interno (funciona igual em Linux e Mac, sem depender de rede host).
docker network connect kind "$(hostname)" 2>/dev/null || true
kind get kubeconfig --internal --name "$CLUSTER" > /tmp/kubeconfig
export KUBECONFIG=/tmp/kubeconfig

# As imagens são buildadas aqui e copiadas para o nó: o cluster não tem registry.
docker build -q --target prod -t corridas-api:k8s api
docker build -q -t corridas-worker:k8s worker
kind load docker-image --name "$CLUSTER" corridas-api:k8s corridas-worker:k8s

existia=$(kubectl -n corridas get deployment api -o name 2>/dev/null || true)
# Job é imutável: apaga o da execução anterior antes de aplicar de novo.
kubectl -n corridas delete job rabbitmq-init --ignore-not-found
# LoadRestrictionsNone: o .env, as chaves e o definitions.json ficam fora de k8s/.
kubectl kustomize --load-restrictor LoadRestrictionsNone k8s | kubectl apply -f -
# Mesma tag a cada build: numa segunda execução, sem restart os pods
# continuariam na imagem anterior. Na primeira, os pods já nascem com ela.
[ -n "$existia" ] && kubectl -n corridas rollout restart deployment/api deployment/worker

kubectl -n corridas rollout status deployment/api --timeout=5m
kubectl -n corridas rollout status deployment/worker --timeout=5m
kubectl -n corridas get pods
echo "api em http://localhost:8080"
