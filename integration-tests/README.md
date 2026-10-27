# Integration tests

Requires JDK 25, Docker Engine and Docker Compose V2. Run commands from the repository root.

## Run

```bash
# All networks
./gradlew :integration-tests:functional:integrationTest

# One network
./gradlew :integration-tests:functional:bitcoinTest
./gradlew :integration-tests:functional:evmTest
./gradlew :integration-tests:functional:tronTest
./gradlew :integration-tests:functional:solanaTest
./gradlew :integration-tests:functional:tonTest
./gradlew :integration-tests:functional:xrpTest
./gradlew :integration-tests:functional:xlmTest

# One test class
./gradlew :integration-tests:functional:bitcoinTest --tests '*BitcoinPaymentsTest'
```

Tests start local nodes automatically. TON also builds its OpenTonAPI image.

## Coverage

- Bitcoin: payments, UTXOs, fees, signing, blocks and Blockbook history.
- EVM: payments, tokens, contracts, approvals, Fanout batches, fees and history.
- TRON: TRX, tokens, contracts, Fanout batches, Energy/Bandwidth fees and Blockbook history.
- Solana: SOL, SPL/Token-2022, programs, fees, lookup tables, nonces and history.
- TON: wallets, payments, contracts, Jettons, fees, blocks and history.
- XRP: payments, atomic batches, tags, fees, signing and history.
- XLM: payments, account creation, muxed addresses, multisig, fee bumps, sponsorship and reserves. See [XLM test coverage](../xlm/src/test/README.md).

Suites check successful transactions and rejection cases, including insufficient funds,
expired transactions, replay and rollback where applicable.

## Unit tests

No Docker required.

```bash
./gradlew :bitcoin:test :blockbook:test :blockbook:blockbook-bitcoin:test
./gradlew :evm:test :evm:evm-contracts:test :evm:evm-spi:test :blockbook:blockbook-evm:test
./gradlew :tron:test :blockbook:blockbook-tron:test
./gradlew :solana:test
./gradlew :ton:test
./gradlew :xrp:test
./gradlew :xlm:test
./gradlew :spi:test :crypto-util:test :secp256k1-support:test :ed25519-support:test
```

## Fanout tests

```bash
# Native and token batches
./gradlew :integration-tests:functional:evmTest --tests '*EvmMultiTransferTest' \
  :integration-tests:functional:tronTest --tests '*TronMultiTransferTest'

# ERC-3009 authorization
./gradlew :integration-tests:functional:evmTest --tests '*FanoutAuthorizationTest' \
  :integration-tests:functional:tronTest --tests '*FanoutAuthorizationTest'

# Fees
./gradlew :integration-tests:functional:evmTest --tests '*FanoutFeesTest' \
  :integration-tests:functional:tronTest --tests '*FanoutFeesTest'
```

Rebuild contract fixtures after Solidity changes:

```bash
cd integration-tests/contracts
npm ci --ignore-scripts
npm run build
```

## Native OpenTonAPI on macOS ARM

Optional; requires Go 1.26, libsodium and libsecp256k1. The TON node still runs in Docker.

```bash
bash integration-tests/docker/tonapi/build-native.sh
./gradlew :integration-tests:functional:tonTest \
  -Dit.tonapi.binary="$PWD/integration-tests/build/tonapi/opentonapi"
```

## Results

- Reports: `integration-tests/functional/build/reports/tests/<task>/index.html`
- Container logs: `integration-tests/functional/build/container-logs/`
