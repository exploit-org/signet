# Blockbook Integration

`blockbook` provides the shared HTTP client and response models. The chain adapters map those responses into Signet transaction APIs:

- `blockbook-bitcoin`: `BlockbookBitcoinExplorer`, including UTXOs and broadcast.
- `blockbook-evm`: `BlockbookEvmTransactionApi` for indexed EVM transactions.
- `blockbook-tron`: `BlockbookTronTransactionApi` for indexed TRON transactions.

Use the adapter shown in the [Bitcoin](../bitcoin/README.md), [EVM](../evm/README.md), or [TRON](../tron/README.md) connection example. Solana and XRP use their node RPC transaction APIs directly.

**On this page:**

- [Read raw indexer data](#read-raw-indexer-data)
- [Choose API layers](#choose-api-layers)
- [Indexing and cursors](#indexing-and-cursors)
- [Transport ownership](#transport-ownership)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.blockbook.BlockbookClient;
```

</details>

## Read raw indexer data

```java
public static void inspect(
        String baseUrl,
        long height,
        String txid
) {
    try (var client = BlockbookClient.builder()
            .baseUrl(baseUrl)
            .build()) {
        var status = client.getStatus();
        var hash = client.getBlockHash(height).blockHash();
        var block = client.getBlock(hash, 1);
        var transaction = client.getTransaction(txid, null);

        System.out.println(status.blockbook().inSync());
        System.out.println(status.blockbook().bestHeight());
        System.out.println(block);
        System.out.println(transaction);
    }
}
```

`BlockbookClient` also exposes address and xpub history, UTXOs, balance history, contract metadata, fee estimates, raw transactions, raw blocks, block filters, and fiat ticker endpoints. Availability depends on the deployed Blockbook backend and chain.

## Choose API layers

Use `provider.transactions().api()` for Signet's normalized transaction reads. Use the adapter's `client()` when you need Blockbook-specific fields, status, explicit page responses, or backend transaction details.

EVM and TRON factories and broadcasters use their node clients. Their Blockbook adapters supply history. Bitcoin's explorer adapter also supplies complete blocks, UTXOs, and transaction broadcast; Core supplies fee estimation in the standard provider setup. `bitcoin.blocks().api().getBlock(height)` uses the raw-block endpoint and returns every transaction, independent of Blockbook page size.

## Indexing and cursors

Check `status.blockbook().inSync()`, `bestHeight()`, and the indexed hash at a known height. Compare with the node when the application needs a freshness bound.

Blockbook determines block page size. The normalized adapter's `limit` caps how many entries are returned from that backend page. For a complete scan, avoid discarding the tail of a backend page by choosing a smaller limit; use the raw page API when you need explicit pagination metadata.

Address history uses an exclusive millisecond timestamp bound. Save transaction IDs and rescan an overlap to handle equal timestamps and delayed indexing. Store block hashes alongside heights for reorganization handling.

## Transport ownership

Builders accept `baseUrl`, optional `authorization`, and optional `jettyx`. Adapters also accept an existing `BlockbookClient` through their builders. The caller keeps ownership of supplied clients and shared transports. Close adapters that create their own resources.
