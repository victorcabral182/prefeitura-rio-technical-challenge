# kind, kubectl e o docker CLI num container: quem avalia só precisa de Docker.
# O kind cria o cluster pelo socket do Docker do host (montado pelo scripts/k8s.sh).
FROM docker:29.9.2-cli
ARG TARGETARCH
ARG KIND_VERSION=v0.33.0
ARG KUBECTL_VERSION=v1.37.2
# Checksum conferido contra o .sha256 publicado junto de cada binário.
RUN set -eux; \
    wget -qO /usr/local/bin/kind "https://github.com/kubernetes-sigs/kind/releases/download/${KIND_VERSION}/kind-linux-${TARGETARCH}"; \
    echo "$(wget -qO- "https://github.com/kubernetes-sigs/kind/releases/download/${KIND_VERSION}/kind-linux-${TARGETARCH}.sha256sum" | cut -d' ' -f1)  /usr/local/bin/kind" | sha256sum -c; \
    wget -qO /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl"; \
    echo "$(wget -qO- "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl.sha256")  /usr/local/bin/kubectl" | sha256sum -c; \
    chmod +x /usr/local/bin/kind /usr/local/bin/kubectl
