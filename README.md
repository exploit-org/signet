# Signet

Java 25 APIs for Bitcoin, EVM, TRON, Solana, and XRP Ledger: accounts, balances,
transaction preparation, signing, submission, blocks, and history.

## Start building

1. [Install dependencies and run your first read](docs/getting-started/README.md).
2. [Connect your blockchain provider](docs/README.md#blockchain-modules).
3. [Create or import an account](docs/shared/accounts-and-signing.md).
4. [Prepare, sign, submit, and confirm a payment](docs/shared/transactions.md).

The [developer documentation](docs/README.md) contains code examples directly on
its pages, including imports and the assumptions for each operation.

## Choose a network

| Network | Guide | Common tasks |
| --- | --- | --- |
| Bitcoin | [Connect](docs/bitcoin/README.md) | [Payments](docs/bitcoin/transactions.md), [full blocks and UTXOs](docs/bitcoin/blocks-and-history.md) |
| EVM | [Connect](docs/evm/README.md) | [Native and ERC20 transfers](docs/evm/transactions.md), [contracts](docs/evm/contracts.md) |
| TRON | [Connect](docs/tron/README.md) | [TRX and TRC20 transfers](docs/tron/transactions.md), [contracts](docs/tron/contracts.md) |
| Solana | [Connect](docs/solana/README.md) | [SOL and SPL transfers](docs/solana/transactions.md), [amount conversion by mint](docs/solana/README.md#amount-conversion-by-mint), [programs](docs/solana/programs.md) |
| XRP | [Connect](docs/xrp/README.md) | [Payments and batches](docs/xrp/transactions.md), [validated results](docs/xrp/blocks-and-history.md) |

## Work on Signet

- [Run unit and real-node integration tests](integration-tests/README.md).
- [Understand the shared API](docs/README.md#provider-services).
