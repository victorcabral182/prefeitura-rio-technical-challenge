#!/bin/sh
# Cluster Kubernetes local com kind. Só precisa de Docker: kind, kubectl e o
# docker CLI rodam num container (k8s/tools) com o socket do Docker do host.
#   ./scripts/k8s.sh up              cria o cluster (se não existir) e aplica tudo
#   ./scripts/k8s.sh kubectl <args>  kubectl contra o cluster (namespace corridas)
#   ./scripts/k8s.sh down            apaga o cluster e os dados dele
# Atenção: montar o docker.sock dá a esse container controle total do Docker do
# host. É o mesmo poder que o próprio kind precisa para criar o cluster.
set -eu
cd "$(dirname "$0")/.."

for f in .env secrets/jwt_private.pem secrets/jwt_public.pem; do
  [ -f "$f" ] || { echo "falta $f: veja 'Como rodar' no README"; exit 1; }
done

docker build -q -t corridas-k8s-tools k8s/tools >/dev/null
TTY=""; [ -t 0 ] && [ -t 1 ] && TTY="-t"
run() { docker run --rm -i $TTY -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD:/repo" -w /repo "$@"; }

case "${1:-}" in
  up) run corridas-k8s-tools sh k8s/up.sh ;;
  down) run corridas-k8s-tools kind delete cluster --name corridas ;;
  kubectl)
    shift
    run --network kind corridas-k8s-tools sh -c \
      'kind get kubeconfig --internal --name corridas > /tmp/kubeconfig && KUBECONFIG=/tmp/kubeconfig kubectl -n corridas "$@"' -- "$@" ;;
  *) echo "uso: $0 up | down | kubectl <args>"; exit 1 ;;
esac
