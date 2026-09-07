# Examples by Task

All examples are written directly in the linked documentation sections. There
are no separate example classes to download or undocumented helper methods to
implement. Start with [runtime setup](../getting-started/README.md) and the
[example conventions](../README.md#reading-the-examples).

## Accounts and payments

| Task | Example |
| --- | --- |
| Generate an account and release its key | [Account lifecycle](../shared/accounts-and-signing.md#account-lifecycle) |
| Import a private key | [Key import](../shared/accounts-and-signing.md#import-an-existing-key) |
| Use an external signer | [External signing](../shared/accounts-and-signing.md#external-signing) |
| Pay a Bitcoin address | [Single payment](../bitcoin/transactions.md#pay-one-recipient) |
| Pay several Bitcoin addresses | [Multiple outputs](../bitcoin/transactions.md#pay-several-recipients) |
| Send the EVM native asset or ERC20 | [Native payment](../evm/transactions.md#send-the-native-asset), [ERC20](../evm/transactions.md#send-erc20) |
| Send TRX or TRC20 | [TRX](../tron/transactions.md#send-trx), [TRC20](../tron/transactions.md#send-trc20) |
| Send SOL or SPL tokens | [SOL](../solana/transactions.md#send-sol), [SPL](../solana/transactions.md#send-spl-tokens) |
| Convert Solana token amounts using mint decimals | [Conversion in both directions](../solana/README.md#amount-conversion-by-mint) |
| Send XRP with a destination tag | [Tagged payment](../xrp/transactions.md#payment-intent) |
| Submit an atomic XRP batch | [Batch](../xrp/transactions.md#atomic-xrp-batch) |

## Contracts and programs

| Task | Example |
| --- | --- |
| Bind a custom ABI or tuple | [Interfaces](../evm/contracts.md#bind-your-own-abi), [structs](../evm/contracts.md#declare-abi-structs) |
| Deploy an EVM contract | [Creation transaction](../evm/contracts.md#deploy-a-contract) |
| Send a token authorization through a relayer | [ERC3009](../evm/transactions.md#direct-transferwithauthorization) |
| Batch ERC20 payments without allowance | [Receive authorization](../evm/transactions.md#fanout-with-authorization) |
| Read or change TRON contract state | [TRON contracts](../tron/contracts.md) |
| Add a memo to a Solana payment | [Instructions](../solana/programs.md#compose-instructions) |
| Use a Solana sponsor, v0, or durable nonce | [Sponsorship](../solana/programs.md#sponsored-v0-payment), [nonce](../solana/programs.md#durable-nonce) |

## Reads and reconciliation

| Task | Example |
| --- | --- |
| Read a complete Bitcoin block | [Block fields and transactions](../bitcoin/blocks-and-history.md#read-a-complete-block) |
| Inspect Bitcoin outputs and confirmations | [UTXOs](../bitcoin/blocks-and-history.md#read-spendable-outputs) |
| Check an EVM receipt or query logs | [Execution](../evm/blocks-and-history.md#inspect-a-submitted-transaction), [logs](../evm/blocks-and-history.md#logs-and-historical-calls) |
| Read TRON confirmed blocks | [TRON reads](../tron/blocks-and-history.md) |
| Track Solana status | [Submission status](../solana/blocks-and-history.md#submission-status) |
| Verify an XRP Payment or Batch | [Validated results](../xrp/blocks-and-history.md#transaction-result) |
| Read raw indexer pagination metadata | [Blockbook](../blockbook/README.md#read-raw-indexer-data) |

[Integration tests](../../integration-tests/README.md) provide additional regression
coverage against local nodes; following these guides does not require copying the
test fixtures into your application.
