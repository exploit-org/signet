# OpenTonAPI and runtime bases are pinned; the patch only configures private-chain fixtures.
# Run the compiler natively; Go under AMD64 emulation crashes on ARM Docker hosts.
FROM --platform=$BUILDPLATFORM golang:1.26-bookworm@sha256:9fdc884aacc3bec89b20ffc69f4bb369c78210e3e4f600387b5128b12c199f81 AS build
WORKDIR /build-dir
ADD --checksum=sha256:6a81f63449800b95541eb71973038b8ef291f5847db1387a0c75423784783bf8 https://codeload.github.com/tonkeeper/opentonapi/tar.gz/def8c61d7186d1063c0c8b3a4d5490254a1d26c1 /tmp/source.tar.gz
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 -C /build-dir
COPY local-chain.patch /tmp/local-chain.patch
RUN git apply /tmp/local-chain.patch
RUN go mod download
RUN apt-get update && apt-get install -y gcc-x86-64-linux-gnu
# tongo ships its Linux emulator only for AMD64, including on ARM build hosts.
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=1 CC=x86_64-linux-gnu-gcc \
    go build -o /tmp/opentonapi github.com/tonkeeper/opentonapi/cmd/api

FROM --platform=linux/amd64 debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171
RUN apt-get update && apt-get install -y openssl ca-certificates libsecp256k1-1 libsodium23 && rm -rf /var/lib/apt/lists/*
COPY --from=build /go/pkg/mod/github.com/tonkeeper/tongo*/lib/linux /app/lib/
COPY --from=build /tmp/opentonapi /usr/bin/opentonapi
COPY --from=build /build-dir/api/openapi.* /app/openapi/
ENV LD_LIBRARY_PATH=/app/lib/
WORKDIR /app
CMD ["/usr/bin/opentonapi"]
