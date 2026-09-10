# Transaction Lifecycle

**On this page:**

- [Prepare, sign, submit, confirm](#prepare-sign-submit-confirm)
- [Amounts](#amounts)
- [Fee limits](#fee-limits)
- [Read APIs](#read-apis)
- [Parse signed data](#parse-signed-data)
- [Errors](#errors)

## Prepare, sign, submit, confirm

1. An intent expresses the requested transfer, recipients, and fee limit.
2. `transactions().factory().create(...)` reads the state needed to prepare an unsigned transaction. Depending on the network, this includes UTXOs, nonce, sequence, recent blockhash, fees, balances, and simulation results.
3. `signer().sign(...)` signs that prepared transaction.
4. `transactions().broadcaster().broadcast(...)` submits the signed bytes and returns `Receipt(hash, fee)`.
5. The application checks inclusion, execution result, and confirmation state using the network APIs.

Persist the signed dump and `signed.hash()` before submitting. If a request times out, query that hash before preparing a replacement. A new nonce, sequence, or recent blockhash can produce a second independently executable payment.

The hash is the transaction ID where available. In TON, `signed.hash()` and
`receipt.hash()` identify the normalized external message. TON creates its
transaction hash after execution; use the message hash to
[resolve the executed transaction](../ton/blocks-and-history.md#find-the-executed-transaction).

Preparation reads network state without reserving it. Serialize preparation and submission per sender where nonce or sequence reuse would matter. A Bitcoin service also needs to reserve selected UTXOs across concurrent requests.

## Amounts

`Recipient(publicAddress, amount)` uses `BigInteger` atomic units:

| Asset | Atomic unit | Decimals |
| --- | --- | --- |
| BTC | satoshi | 8 |
| EVM native asset | wei | 18 with the default converter |
| TRX | sun | 6 |
| SOL | lamport | 9 |
| TON | nanoton | 9 |
| XRP | drop | 6 |

Use `provider.converter().toAtomicAmount(new BigDecimal("0.01"))` and `toDisplayAmount(...)` at application boundaries. Conversion rejects precision that the asset cannot represent. Token converters query the token's decimals; see the network's token examples.

## Fee limits

`feeLimit` on a transfer intent caps the estimated network fee in native atomic units. Token payment limits are still denominated in the native asset. A `null` intent limit adds no caller cap; chain-specific options may impose another cap.

For supported native single transfers, `withFee=true` subtracts the estimated fee from the requested recipient amount. The delivered amount is smaller. `withFee=false` keeps the recipient amount and requires the sender to fund the fee separately.

The estimate can differ from the executed fee. On EVM, unused gas reduces the actual charge. TRON charges depend on resources and activation. Solana token account rent and Token-2022 transfer fees are separate from the network fee. XRP reserves remain in the account after a payment.

The Bitcoin unsigned transaction exposes its fee as `OptionalLong`. The supplied Blockbook Bitcoin broadcaster returns `Receipt` with a null fee; retain the prepared transaction's fee for reconciliation.

TON sends the requested outgoing value with fees paid separately. Destination
execution can consume part of that value or bounce it. Its fee limit caps the
sender estimate, without imposing an on-chain gas cap.

In a token batch with approval transactions, the batch's fee cap covers the batch transaction. Approval transactions consume additional fees.

## Read APIs

- `blocks().api().getLatestBlockHeight()` returns the provider's chosen chain position. Solana returns a slot; TON returns a masterchain seqno; XRP returns a ledger index.
- `blocks().api().getBlock(position)` reads the network's block model. Bitcoin includes all transactions; EVM and TRON include their successful transaction views; Solana and XRP expose block or ledger metadata.
- `transactions().api().getTransaction(txid)` reads one transaction through the configured transaction API.
- `getTransactions(position, page, limit)` reads a page using a one-based page number.
- `getTransactions(address, searchAfterMs)` uses an exclusive Unix-millisecond lower bound.

History retention and confirmation semantics depend on the backend. Solana and XRP filter successful transactions after selecting a page of raw entries. An empty filtered page can therefore precede a later nonempty page.

For long-running indexing, retain a block, slot, or ledger cursor and transaction IDs. When using timestamps, rescan an overlapping window and deduplicate. Multiple transactions can share a timestamp, and an indexer can expose them at different times.

## Parse signed data

Use the network parser on `signed.dump()`. Wire formats differ:

- Bitcoin: serialized transaction hex. Input values and the fee require previous-output context.
- EVM: `0x`-prefixed signed RLP envelope. The parser supports legacy and typed envelopes 1 through 4.
- TRON: transaction JSON containing raw transaction data, its protobuf hex, and signatures.
- Solana: base64 wire transaction. Local fee, rent, and expiry context must be stored separately if needed after parsing.
- XRP: canonical transaction blob hex.

TON's parser takes an executed transaction BOC from `transaction.dump()`, not the
external message in `signed.dump()`. See [TON transaction data](../ton/blocks-and-history.md#parse-transaction-data).

Parsing reconstructs the transaction represented by the dump. Execution status comes from the network API.
