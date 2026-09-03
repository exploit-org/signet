# Integration tests

- `src/testFixtures/java`: shared container lifecycle and Bitcoin fixtures.
- `docker/docker-compose.yml`: Bitcoin Core regtest and Blockbook as separate services.
- `functional/src/test/java`: usage scenarios through `BitcoinProvider`.

## Run

Requirements: JDK 25, Docker Engine, and Docker Compose V2 (`docker compose`).

```bash
./gradlew integrationTest
# Equivalent:
./gradlew :integration-tests:functional:test

# One class:
./gradlew :integration-tests:functional:test --tests '*BitcoinPaymentsTest'

# Bitcoin unit tests without containers:
./gradlew :bitcoin:test :blockbook:test :blockbook:blockbook-bitcoin:test
```