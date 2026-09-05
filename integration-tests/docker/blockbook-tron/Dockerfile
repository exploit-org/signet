FROM debian:12.12-slim@sha256:d5d3f9c23164ea16f31852f95bd5959aad1c5e854332fe00f7b3a20fcc9f635c AS build

ARG DEBIAN_FRONTEND=noninteractive
ARG TARGETPLATFORM
ENV GOLANG_VERSION=go1.25.4
ENV GOPATH=/go
ENV PATH=/opt/go/bin:/go/bin:${PATH}
ENV CGO_CFLAGS=-I/opt/rocksdb/include
ENV CGO_LDFLAGS="-L/opt/rocksdb -ldl -lrocksdb -lstdc++ -lm -lz -lbz2 -lsnappy -llz4 -lzstd"

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential ca-certificates git libbz2-dev libgflags-dev liblz4-dev \
        libsnappy-dev libzstd-dev libzmq3-dev pkg-config wget zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        architecture=arm64; checksum=a68e86d4b72c2c2fecf7dfed667680b6c2a071221bbdb6913cf83ce3f80d9ff0; \
    else \
        architecture=amd64; checksum=9fa5ffeda4170de60f67f3aa0f824e426421ba724c21e133c1e35d6159ca1bec; \
    fi \
    && wget -q "https://dl.google.com/go/${GOLANG_VERSION}.linux-${architecture}.tar.gz" -O /tmp/go.tar.gz \
    && echo "${checksum}  /tmp/go.tar.gz" | sha256sum -c - \
    && tar -C /opt -xf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

RUN git clone --branch v9.10.0 --depth 1 https://github.com/facebook/rocksdb.git /opt/rocksdb \
    && test "$(git -C /opt/rocksdb rev-parse HEAD)" = ae8fb3e5000e46d8d4c9dbf3a36019c0aaceebff \
    && cd /opt/rocksdb \
    && CFLAGS=-fPIC CXXFLAGS=-fPIC PORTABLE=1 DISABLE_WARNING_AS_ERROR=1 make -j2 static_lib

RUN git clone --branch v0.6.0 --depth 1 https://github.com/trezor/blockbook.git /src \
    && test "$(git -C /src rev-parse HEAD)" = 6e1299a2c4c31f7d5b94a53e293d8cfb8cafdfe4
COPY tron-private-network.patch /tmp/tron-private-network.patch
RUN git -C /src apply --check /tmp/tron-private-network.patch \
    && git -C /src apply /tmp/tron-private-network.patch \
    && cd /src \
    && go build -o /usr/local/bin/blockbook -ldflags="-s -w -X github.com/trezor/blockbook/common.version=0.6.0 -X github.com/trezor/blockbook/common.gitcommit=6e1299a2c4c31f7d5b94a53e293d8cfb8cafdfe4"

FROM debian:12.12-slim@sha256:d5d3f9c23164ea16f31852f95bd5959aad1c5e854332fe00f7b3a20fcc9f635c
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        libbz2-1.0 libgflags2.2 liblz4-1 libsnappy1v5 libstdc++6 libzstd1 libzmq5 zlib1g \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/blockbook /usr/local/bin/blockbook
COPY --from=build /src/static /static
ENTRYPOINT ["/usr/local/bin/blockbook"]
