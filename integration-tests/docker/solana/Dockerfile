FROM --platform=linux/amd64 ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl bzip2 libssl3t64 libudev1 \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 https://github.com/anza-xyz/agave/releases/download/v3.1.8/solana-release-x86_64-unknown-linux-gnu.tar.bz2 -o /tmp/solana.tar.bz2 \
    && echo 'e951bb8127c57460bc3ebca1671952e9b164e249d713fcebe2c125f70b8791e8  /tmp/solana.tar.bz2' | sha256sum -c - \
    && tar -xjf /tmp/solana.tar.bz2 -C /opt \
    && rm /tmp/solana.tar.bz2
ENV PATH="/opt/solana-release/bin:${PATH}"
EXPOSE 8899 8900
ENTRYPOINT ["solana-test-validator"]
CMD ["--reset", "--ledger", "/tmp/ledger", "--bind-address", "127.0.0.1", "--rpc-port", "8899", "--faucet-sol", "1000000", "--quiet"]
