# Integration tests

- `src/testFixtures/java`: shared container lifecycle and Bitcoin/EVM/TRON fixtures.
- `docker/docker-compose.yml`: Bitcoin Core regtest and Blockbook as separate services.
- `docker/evm-compose.yml`: Anvil and a separate Ethereum-configured Blockbook.
- `docker/tron-compose.yml`: official TRE private chain and Blockbook v0.6.0 built from its tagged source.
- `functional/src/test/java`: usage scenarios through `BitcoinProvider`, `EvmProvider`, and `TronProvider`.

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
```

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
