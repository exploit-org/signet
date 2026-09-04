# Integration tests

- `src/testFixtures/java`: shared container lifecycle and Bitcoin/EVM fixtures.
- `docker/docker-compose.yml`: Bitcoin Core regtest and Blockbook as separate services.
- `docker/evm-compose.yml`: Anvil and a separate Ethereum-configured Blockbook.
- `functional/src/test/java`: usage scenarios through `BitcoinProvider` and `EvmProvider`.

## Run

Requirements: JDK 25, Docker Engine, and Docker Compose V2 (`docker compose`).

```bash
./gradlew integrationTest
# Equivalent:
./gradlew :integration-tests:functional:test

# One class:
./gradlew :integration-tests:functional:test --tests '*BitcoinPaymentsTest'

# EVM scenarios only:
./gradlew :integration-tests:functional:test --tests '*Evm*Test'

# Bitcoin unit tests without containers:
./gradlew :bitcoin:test :blockbook:test :blockbook:blockbook-bitcoin:test

# EVM unit tests without containers:
./gradlew :evm:test :evm:evm-contracts:test :evm:evm-spi:test :blockbook:blockbook-evm:test
```