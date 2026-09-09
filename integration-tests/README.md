# Integration tests

- `src/testFixtures/java`: shared container lifecycle and Bitcoin/EVM/TRON/Solana/TON/XRP fixtures.
- `docker/docker-compose.yml`: Bitcoin Core regtest and Blockbook as separate services.
- `docker/evm-compose.yml`: Anvil and a separate Ethereum-configured Blockbook.
- `docker/tron-compose.yml`: official TRE private chain and Blockbook v0.6.0 built from its tagged source.
- `docker/solana-compose.yml`: Agave 3.1.8 test validator, with its real System/SPL/Token-2022 programs.
- `docker/xrp-compose.yml`: rippled 3.3.0 standalone, pinned by image digest, with BatchV1_1 enabled.
- `docker/ton-compose.yml`: private MyLocalTon validator, pinned by image digest.
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

# TON through a real validator and OpenTonAPI (the image is built automatically):
./gradlew tonTest
./gradlew :ton:test
```

## TON

Each class starts a fresh MyLocalTon private network with global ID `-3` and a local
OpenTonAPI instance. Node images are pinned for AMD64/ARM64; the fixture selects by
daemon architecture.
No `.env`, public-chain funds or hosted API token is needed.
The fixture gives Simplex a one-second target interval and a three-second first-block
deadline; the image's subsecond defaults repeatedly exhaust collation deadlines in Docker.

OpenTonAPI is pinned to `def8c61d7186d1063c0c8b3a4d5490254a1d26c1`. Its small
[fixture patch](docker/tonapi/local-chain.patch) configures local Jetton discovery and
removes public preload/price/address-book inputs and staking-reward background reads.
The latter require election history that a fresh genesis lacks. HTTP handlers, TVM
execution, transaction serialization and lite-client reads are unchanged.

Run the tagged TON suite on an AMD64 or ARM64 Docker host:

```sh
./gradlew tonTest
```

`tonTest` builds the OpenTonAPI image before running tests. The build stage runs Go
on Docker's native architecture and uses an AMD64 CGO cross-compiler, avoiding Go
compiler crashes under QEMU. The runtime remains AMD64 because tongo ships its
Linux emulator for AMD64. Docker uses cached layers on subsequent runs.

An optional native backend remains available on macOS ARM. It requires Go 1.26,
`libsodium` and `libsecp256k1` on the host. The script verifies the pinned source
archive, applies the same fixture patch and builds a local binary:

```sh
bash integration-tests/docker/tonapi/build-native.sh
./gradlew tonTest \
  -Dit.tonapi.binary="$PWD/integration-tests/build/tonapi/opentonapi"
```

The native process and Docker backend use the same OpenTonAPI source. Tests own the
process lifecycle and save logs under `functional/build/container-logs/tonapi-*.log`.
The validator still runs in Testcontainers.

The validator creates blocks continuously. A public genesis key from
[`mylocalton-docker` revision `7ffe58315280eb7359a45929c921f32c4bdce5ce`](https://github.com/neodix42/mylocalton-docker/tree/7ffe58315280eb7359a45929c921f32c4bdce5ce)
bootstraps a generated funding wallet through a Signet-signed transaction. Subsequent
funding uses that dedicated wallet, since MyLocalTon also sends validator-election
messages from genesis. The genesis V3R2 wallet uses workchain `-1` and wallet ID `42`.
This fixture key belongs only to the disposable private chain. No mainnet/testnet
endpoint or funded external account is required.
OpenTonAPI reads the generated liteserver configuration after the validator healthcheck
passes. Ports are assigned dynamically. No `.env` file is needed.

`TonPaymentsTest` covers V3R1, V3R2, V4R2, V5R1 and Highload V3: first-transfer deployment,
subsequent transfers, UTF-8 comments, sender compute/action success, delivery to the
destination, replay/stale-seqno rejection, expiry, insufficient balance and fee limits.
Balance reconciliation includes the sender's transaction and forwarding fees plus
the recipient's transaction fees, including storage charged on subsequent receipts.
Rejected operations assert unchanged balances. The independent TVM vectors separately
check on-chain replay and expiry rejection; the broadcaster cases check local rejection.

`sendBoc` acknowledges an external message, so the test follows its normalized message
hash to the executed transaction, then follows the outgoing internal message to the
recipient. It does not treat RPC acknowledgement as settlement. Readiness and execution
use bounded state polling. Container logs are saved under
`functional/build/container-logs/TonPaymentsTest/`; containers and volumes are removed
on completion or failure.

See [`ton/README.md`](../ton/README.md) for the current API and
[`TON vector provenance`](../ton/src/test/resources/vectors/README.md) for SDK/TVM checks.

`TonContractsTest` deploys the committed [counter fixture](src/testFixtures/resources/ton/README.md)
through V4R2/V5R1 and invokes it through those wallets and Highload V3. Highload's direct
StateInit restriction is checked before submission. It checks typed getters and getter
arguments, verifies owner authorization, and confirms storage rollback after a destination
exception. A successful sender transaction is checked separately from the destination's
compute result; contract failure is allowed to charge fees and generate a bounce.

`TonJettonsTest` deploys the official TEP-74 fixture, mints, transfers with a notification
payload, checks native getter and indexed token balances, burns and rejects an excessive
transfer. `TonApiTest` exercises `TonProvider`, masterchain/shard block reads, address
history, hash lookup, transaction parsing and masterchain interval history. OpenTonAPI's
lightweight storage does not implement message-hash lookup; that endpoint is exposed for
hosted TONAPI but is not counted as covered by the local node tests.

## Fanout on EVM and TRON

`EvmMultiTransfer` / `TronMultiTransfer` send native currency through a deployed
Fanout. `ERC20MultiTransfer` / `TRC20MultiTransfer` use its token method. Every intent
contains `fanoutAddress`, a nonempty list of `Recipient` values and an optional
`BigInteger feeLimit`; EVM intents also contain `chainId`, and token intents contain
`contractAddress`. TRON addresses use the selected account descriptor's Base58 format.

```java
var nativeEvm = new EvmMultiTransfer(fanoutAddress, recipients, chainId, feeLimit);
var tokenEvm = new ERC20MultiTransfer(fanoutAddress, tokenAddress, recipients, chainId, feeLimit);
var nativeTron = new TronMultiTransfer(fanoutAddress, recipients, feeLimit);
var tokenTron = new TRC20MultiTransfer(fanoutAddress, tokenAddress, recipients, feeLimit);
```

Pass the intent to `provider.transactions().factory().create(sender, intent, descriptor)`.
The existing factory simulates the entire call and checks its fee and sender balance.
The native transaction value is exactly the sum of recipient amounts; fees are separate.
The limit applies to the whole transaction in wei (EVM) or sun (TRON).
Token intents use an existing allowance by default. `factory.approvals(sender, intent)`
on EVM, or `factory.approvals(sender, intent, descriptor)` on TRON, returns the needed
ERC20/TRC20 calls: none when allowance is sufficient, one exact-amount approve when it
is zero, or `approve(0)` followed by exact-amount approve when an insufficient nonzero
allowance needs replacing (also compatible with the pinned USDT fixture).
Prepare, sign, broadcast and confirm these calls **one at a time**, then create the
Fanout transaction against the updated state. The factories never sign or broadcast
approvals; they return calls, not a prebuilt set of transactions with stale nonces.

```java
for (var approval : evm.transactions().factory().approvals(sender, tokenEvm)) {
    var unsigned = evm.transactions().factory().create(sender, approval, chainId);
    // Sign, broadcast and wait for successful confirmation before continuing.
}
var unsignedBatch = evm.transactions().factory().create(sender, tokenEvm, null);
```

For a token known to support ERC-3009, attach its signed **receive** authorization:
use a deployment of the updated Fanout containing `transferTokenWithAuthorization`.

```java
var authorization = new ERC3009ReceiveAuthorization(
        tokenDomain, senderAddress, fanoutAddress, totalAmount,
        validAfter, validBefore, randomNonce32);
var signature = (EvmSignature) evm.signer().sign(sender, authorization);
var authorized = tokenEvm.withAuthorization(new ERC3009Authorization(authorization.call(signature).data()));
var unsignedBatch = evm.transactions().factory().create(sender, authorized, null);
```

`TRC20MultiTransfer.withAuthorization` accepts the same `ERC3009Authorization` payload
from a compatible signer, with ABI addresses represented by their 20-byte values.
It does not add ERC-3009 support to ordinary TRC20 tokens. Signet's EVM typed-data models
can encode that payload; TRON's fallback signer returns `RawSignature`, not `EvmSignature`.
The TRON authorization integration test shows the conversion using the existing signer.

Token capability and its exact EIP-712 domain must come from verified token metadata.
ERC-3009 has no universal ERC-165 discovery requirement; the factories do not guess
support from a symbol, bytecode selector or a failed RPC call. An attached authorization
selects `transferTokenWithAuthorization` and suppresses approval preparation. An invalid,
expired, replayed or unsupported authorization fails simulation, without falling back to
allowance. Without authorization the existing allowance path is selected.

The Fanout entry point accepts only the fixed `receiveWithAuthorization(...,v,r,s)` ABI.
It validates that the authorizer is the outer transaction sender, the payee is Fanout,
and the signed value is the batch total. The transaction signature binds the recipients
and amounts; this entry point does not accept a third-party relayer. Fanout calls the
token's `receiveWithAuthorization`, then reuses the normal distribution and balance checks.

All distribution methods are atomic: a failed payment reverts all payments in the batch,
including the token pull, allowance consumption or authorization nonce consumption.
Already confirmed approval transactions remain confirmed if a later batch fails; the
sender can retry or revoke the remaining allowance. Approvals have their own network
fees; the intent's `feeLimit` applies to the Fanout transaction. A confirmed revert can still charge network
fees. The integration tests deploy `evm/src/main/solidity/Fanout.sol` and check balances,
fee caps, standard/no-return tokens and rollback after the second recipient starts
rejecting payments. The pinned `solc824` compiler builds that source with the Paris
opcode target for both VMs; generated ABI, bytecode and source hash are in
`src/testFixtures/resources/evm/contracts.json`.

```bash
./gradlew :integration-tests:functional:test --tests '*EvmMultiTransferTest' --tests '*TronMultiTransferTest'
./gradlew :integration-tests:functional:test --tests '*FanoutAuthorizationTest'
# Fee comparison using confirmed receipts on the pinned local nodes:
./gradlew :integration-tests:functional:test --tests '*FanoutFeesTest'
# Recompile fixtures after changing Solidity (from integration-tests/contracts):
npm ci --ignore-scripts
npm run build
```

Measured gas, Energy and actual fee results, with methodology and limits, are in
[fanout-fees.md](fanout-fees.md).

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
