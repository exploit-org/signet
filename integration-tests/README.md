# Integration tests

- `src/testFixtures/java`: shared container lifecycle and Bitcoin/EVM/TRON/Solana/XRP fixtures.
- `docker/docker-compose.yml`: Bitcoin Core regtest and Blockbook as separate services.
- `docker/evm-compose.yml`: Anvil and a separate Ethereum-configured Blockbook.
- `docker/tron-compose.yml`: official TRE private chain and Blockbook v0.6.0 built from its tagged source.
- `docker/solana-compose.yml`: Agave 3.1.8 test validator, with its real System/SPL/Token-2022 programs.
- `docker/xrp-compose.yml`: rippled 3.3.0 standalone, pinned by image digest, with BatchV1_1 enabled.
- `functional/src/test/java`: usage scenarios through the blockchain providers.

## Run

Requirements: JDK 25, Docker Engine, and Docker Compose V2 (`docker compose`).

TRON contract transaction preparation requires `/wallet/estimateenergy`: enable
`vm.estimateEnergy = true` and `vm.supportConstant = true` on your node, or choose a
provider exposing it. The pinned TRE supports it. Read-only calls still use
`triggerconstantcontract`. The factory fails explicitly if precise estimation is
unavailable; it does not silently substitute consumed energy for the required limit.

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

# TRON scenarios only (private chain, Blockbook, TRX, USDT-compatible TRC20, TRC721):
./gradlew :integration-tests:functional:test --tests '*Tron*Test'

# TRON unit/vector tests without containers:
./gradlew :tron:test :blockbook:blockbook-tron:test

# Solana validator scenarios:
./gradlew :integration-tests:functional:test --tests '*Solana*Test'

# Solana official vectors and pure unit/property tests:
./gradlew :solana:test

# XRP native payments and atomic batches, both curves, tags, fees, history, rollback and replay/expiry:
./gradlew :integration-tests:functional:test --tests '*Xrp*Test'
./gradlew :xrp:test
```

## XRP

The XRP suite runs a fresh standalone rippled for each test class and explicitly
closes ledgers. It signs funding payments locally with the public standalone genesis
key, then sends payments through the provider using generated secp256k1 and Ed25519
accounts. AccountSet setup for the destination-tag test uses the local node's signing
API and the public genesis seed; production XRP code submits signed blobs only.
The image is AMD64 and runs under Docker emulation on Apple Silicon. RPC is exposed
only on a random loopback port; the test configuration enables its admin methods for
ledger advancement. Do not use this standalone configuration for a public node.
Container logs are saved in `functional/build/container-logs/` on success and failure.

`XrpMultiTransfer` prepares one atomic Batch of 2–8 native XRP payments from the same
sender. Each `XrpTransfer` carries its own destination/source tags. Set `feeLimit`
in drops on the batch; inner transfers must leave it null and `withFee` false.
The factory checks that the validated ledger enables `BatchV1_1` and applies both
the transfer limit and `XrpTransactionOptions.maxFee` to the whole batch fee.
Regular Payments and Batches share the signer/parser/broadcaster; raw transaction
contents are available through `data()` (`XrpPayment` or `XrpBatch`).

```java
var intent = new XrpMultiTransfer(List.of(
        new XrpTransfer(new Recipient(firstAddress, firstAmount), 0L),
        new XrpTransfer(new Recipient(secondAddress, secondAmount), secondTag)
), feeLimit);
var unsigned = provider.transactions().factory().create(sender, intent);
var signed = provider.signer().sign(sender, unsigned);
```

A validated Batch can return outer `tesSUCCESS` even when its payments rolled back.
Use `XrpIndexedTransaction.successful()`, which also verifies that all inner payments
committed. `innerTransactions()` exposes their results; each carries `parentBatchId()`.
On atomic rollback the inner list is empty and only the outer fee is charged.
Other Batch modes, multiple senders, tickets and issued-currency payments are unsupported.

## Solana

AMD64 uses the official Agave 3.1.8 release archive with a checked SHA-256.
ARM64 builds the same upstream commit `2717084afeeb7baad4342468c27f528ef617a3cf`
with Rust 1.86 and `Cargo.lock`; the official AMD64 binary requires AVX and cannot
run under Apple Silicon's Docker emulation. The environment chooses the Dockerfile
from the Docker daemon architecture. The first ARM build takes longer and needs
space for the Rust/C++ build; subsequent runs reuse the tagged image.
The validator container enables `io_uring` with a container-scoped seccomp override,
required by Agave 3.1. It does not mount host directories or use privileged mode.

Each test class gets its own local validator. Accounts are generated per scenario
and funded through the validator faucet. Tests fail if Docker or the validator is
unavailable; there is no mock RPC or automatic skip. Logs are saved under
`functional/build/container-logs/`.

Scenarios cover SOL transfers and history, fee-inclusive sweeps, fee sponsorship,
priority fees and caps, atomic execution failures, classic SPL lifecycle and multisig,
Token-2022 transfer fees and required memos, versioned messages with real lookup tables,
durable nonces and recent-blockhash expiration. Each successful submission compares the
estimated network fee to the confirmed `meta.fee`; token account rent is checked separately.

`SolanaProgramsTest` also deploys the pinned upstream
[write-to-account SBF program](functional/src/test/resources/solana/write-to-account/README.md)
through loader-v3 RPC transactions. It checks the uploaded executable bytes, invokes the
program through arbitrary `SolanaInstruction` lists, reads persisted account data, and
verifies readonly-account rejection and atomic rollback on a confirmed program error.
The fixture is checked in with its source, license and SHA-256; no program compilation
or download is needed during the test run.

RPC history is scoped to the supplied account. Token-account history is queried using
that token account's address. A wallet-wide history including closed token accounts
requires an indexer and is not synthesized from the validator's current accounts.

The TRON image is pinned to `tronbox/tre:2.0.0`. Blockbook is built from the exact
upstream `v0.6.0` commit; the build applies only the checked-in private-genesis
compatibility patch because upstream accepts Mainnet and Nile genesis IDs only.

TRON unit tests include pinned official mainnet transaction/address snapshots and
an independent java-tron protobuf descriptor oracle (see
`tron/src/test/resources/official/README.md`). Private-chain tests exercise native
TRX, fee-inclusive account activation, a deployed USDT-compatible historical
TetherToken (6 decimals and optional return data), TRC721, simulation reverts,
signing/broadcasting, confirmed receipts, and Blockbook indexing. Every payment
checks actual burned fees against the pre-signing estimate.

Stateful TRON scenarios additionally cover:

- Duplicate broadcast: one debit, one indexed transfer, unchanged transaction/signature bytes on node lookup.
- Expiration and invalid TAPOS: node rejection without moving funds or activating the recipient.
- USDT allowance: approval, delegated collection, non-zero-to-non-zero approval rejection, and revocation.
- State changes after simulation: allowance revocation causes admission rejection in the pinned TRE;
  pausing USDT produces a confirmed `FAILED/REVERT`, burns fees, moves no tokens, and is excluded
  from node/Blockbook successful-payment histories.
- Successful simulation with insufficient TRX: the factory refuses the unfunded contract call.
- Payable deposit/withdrawal: native `call_value`, contract balances, token balances, and actual fees agree.
- TRC1155 batch: dynamic arrays/data, token IDs/amounts in Blockbook, and atomic rejection of mismatched arrays.
- Nonstandard tokens: neither `false` nor malformed ABI output becomes a prepared successful payment.
- First/repeated USDT credits, both to inactive and TRX-activated recipients: the zero-token-balance
  write costs more Energy in both cases; TRC20 transfers themselves do not activate TRON accounts.
- Stake 2.0 and received Energy delegation: USDT transfers with a one-sun TRX balance, partial
  Energy coverage with mixed resource/TRX payment, and fresh estimates after delegation revocation.

`TronHttpApiTest` runs a loopback HTTP server without Docker. It exercises the actual
REST proxy/mappers: routes, methods, visible/hex address modes, int64 values, HTTP
401/429/500/503, malformed/empty responses, fractional energy/resource quotas, node error messages,
broadcast payload and returned txid, and no automatic retry of rejected broadcasts.

Fee calculation is deliberately split: native transfers estimate bandwidth and, for
inactive recipients, the separate activation charges from chain parameters. Contract
calls use `E = max(energy_required, energy_used)` and query the sender's current
`available = max(EnergyLimit - EnergyUsed, 0)` via `/wallet/getaccountresource`.
The quota already includes received delegation; it must not be added again.
The TRX reserve is `max(E - available, 0) × current Energy price + bandwidth fee`.
Payable `call_value` is required separately. Full Energy coverage does not waive bandwidth.
`fee_limit` remains `E × current Energy price`: the protocol caps total caller Energy,
including staked/delegated Energy, not just the burned TRX. The payable-withdrawal regression
demonstrates why `energy_used` alone is insufficient for nested CALLs. Resource responses
are not cached. The reserve still conservatively ignores any contract deployer's contribution;
it is not a promise of exact TRX burn or a reservation of the account's on-chain resources.

These are compatibility/regression checks, not a mainnet certification. Resource
and contract state can change after simulation. The standard signer supports
single-owner TransferContract/TriggerSmartContract, not account permission updates
or multisignature workflows; the codec preserves their metadata without claiming
to authorize them. A broadcast receipt is submission acknowledgement, not proof
of settlement. Production settlement must wait for solid/confirmed execution and
apply the application's confirmation/reorg policy.

The pinned TRE specifically rejects the historical USDT `INVALID`-opcode allowance
failure during admission; that assertion describes this test runtime, not every
mainnet TVM failure. The separate paused-USDT test covers a genuinely mined revert.
Remaining deployment checks include a public-network smoke test against the intended
node/indexer versions, concurrent resource spending and dynamic energy changes, and
the application's recovery/idempotency policy after connection loss or reorg.
