# Signet Documentation

Signet provides Java APIs for accounts, balances, transaction preparation, signing, submission, blocks, and transaction history across five blockchain environments.

**On this page:**

- [Start here](#start-here)
- [Provider services](#provider-services)
- [Blockchain modules](#blockchain-modules)
- [Common tasks](#common-tasks)
- [Reading the examples](#reading-the-examples)

## Start here

Follow this order for a first integration:

1. [Install dependencies, configure native access, and read a Bitcoin block](getting-started/README.md).
2. Choose a network below and build its provider with matching node and indexer endpoints.
3. [Generate or import an account](shared/accounts-and-signing.md), then fund its address on that network.
4. Open the network's **Transactions** page to prepare, inspect, sign, and submit a payment.
5. Open **Blocks and history** to verify execution and the confirmation state your application requires.

Use the [task-oriented examples index](examples/README.md) when you already know
what you want to build. Examples are embedded in the relevant Markdown pages.

## Provider services

| Entry point | Use it for | Network access |
| --- | --- | --- |
| `accounts().generator()` / `factory()` | Generate an account or wrap a key provider | Local for in-memory keys |
| `accounts().address()` | Derive and validate an address | Local |
| `accounts().balance()` | Read native or supported token balances | Yes |
| `transactions().factory()` | Prepare an intent using current chain state | Yes |
| `signer()` | Sign the prepared value with the account's key provider | Depends on the key provider |
| `transactions().broadcaster()` | Submit signed transaction bytes | Yes |
| `blocks().api()` / `transactions().api()` | Read chain state, execution, and history | Yes |
| `transactions().parser()` | Decode an existing signed dump | Local |
| `converter()` | Convert display amounts to atomic units and back | Token metadata may require RPC |

See [transaction lifecycle, amounts, and fees](shared/transactions.md) for the
shared rules and [Blockbook integration](blockbook/README.md) for indexer ownership
and pagination.

## Blockchain modules

| Module | Transactions | Blocks and history | Contracts and programs |
| --- | --- | --- | --- |
| [Bitcoin](bitcoin/README.md) | [Payments, fee budgets, multiple outputs](bitcoin/transactions.md) | [Blocks, history, UTXOs](bitcoin/blocks-and-history.md) | Legacy, SegWit, Taproot key path |
| [EVM](evm/README.md) | [Native, ERC20, fanout](evm/transactions.md) | [Finalized blocks, receipts, logs](evm/blocks-and-history.md) | [ABI calls, deployment, permits](evm/contracts.md) |
| [TRON](tron/README.md) | [TRX, TRC20, fanout](tron/transactions.md) | [Confirmed blocks and history](tron/blocks-and-history.md) | [TRC20 and custom calls](tron/contracts.md) |
| [Solana](solana/README.md) | [SOL, SPL, sponsored transactions](solana/transactions.md) | [Slots, status, account history](solana/blocks-and-history.md) | [Instructions, v0, durable nonces](solana/programs.md) |
| [XRP](xrp/README.md) | [Payments, tags, atomic batches](xrp/transactions.md) | [Validated ledgers and results](xrp/blocks-and-history.md) | Direct XRP Payment and Batch |

## Common tasks

- Send a payment: open the network's transaction page, prepare an unsigned transaction, inspect its fee, sign, submit, and verify execution.
- Receive deposits: choose an address format, read blocks or indexed history, and persist transaction identity plus network confirmation state.
- Pay several recipients: Bitcoin uses multiple outputs, EVM and TRON use a deployed Fanout contract, Solana uses multiple instructions, XRP uses its supported Batch amendment.
- Use an external signer: implement the [key provider and signing strategy](shared/accounts-and-signing.md#external-signing).
- Build and publish artifacts: [Publishing](publishing.md).

## Reading the examples

Examples target the source in this repository. Each API page includes an import
block. Put the shown methods inside your application's class; smaller statement
snippets belong inside a method. Inputs such as `sender`, `destination`, `rpcUrl`,
and `tokenDomain` are supplied by your application and explained by the section.

`prepare...` methods return an unsigned transaction. Only examples that explicitly
call `broadcast(...)` submit a transaction. Keep clients and accounts alive through
the entire operation, then close clients and destroy accounts you own.

Use decimal strings with `BigDecimal`, and pass atomic `BigInteger` amounts to
intents. Fee units, timestamp units, finality, and transaction result types are
specified on the network's pages. A submission receipt alone does not establish
successful execution.
