# Jetton fixture

Unmodified TON Foundation reference contracts from
[token-contract at `1182ad99413242f09925d50e70ccb7e0e09f94d4`](https://github.com/ton-blockchain/token-contract/tree/1182ad99413242f09925d50e70ccb7e0e09f94d4).
The fixture uses the discoverable master and standard Jetton wallet.
The upstream license is included in `LICENSE`; its `stdlib.fc` carries its own LGPL notice.

`jetton.json` contains both compiled BOCs and SHA-256 hashes for every compiler input.
Normal Gradle runs load the committed artifact; they do not compile or download contracts.
Regenerate with the compiler pinned in the TON vector lockfile:

```sh
NODE_PATH="$PWD/ton/src/test/resources/vectors/node_modules" node integration-tests/src/testFixtures/resources/ton/jetton/compile.cjs
```

The Java fixture adds on-chain metadata (SGNT, six decimals) and creates a mint message
for the reference master's admin. The functional scenario deploys, mints, transfers,
checks transfer notification payloads, burns and verifies rejection without token balance changes.
