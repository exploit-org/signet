# TRON Blocks and History

[Connection](README.md) · [Examples index](../examples/README.md)

```java
public static void inspect(
        TronProvider tron,
        long height,
        String txid,
        String address,
        long afterMs
) {
    var block = tron.blocks().api().getBlock(height);
    var raw = tron.client().transaction(txid);
    var indexed = tron.transactions().api().getTransaction(txid);
    var page = tron.transactions().api().getTransactions(height, 1, 100);
    var history = tron.transactions().api().getTransactions(address, afterMs);

    System.out.println(block.hash());
    System.out.println(raw);
    System.out.println(indexed);
    System.out.println(page);
    System.out.println(history);
}
```

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.tron.TronProvider;
```

</details>

## Reads

- `getLatestBlockHeight()` and `getLatestBlock()` read the node's latest confirmed block.
- `getBlock(height)` returns `TronBlock` with height, hash, timestamp in milliseconds, and mapped transactions.
- Block mapping excludes transactions with explicit failed execution results. Entries without a `ret` result are retained by the mapper.
- `client().transaction(txid)` reads the node transaction representation.
- `transactions().api()` reads through the configured history backend, normally Blockbook.

`TronIndexedTransaction` includes sender, destination, native value, contract type, and token transfers. Use token-transfer entries when accounting for TRC20 payments; the native value alone does not describe token movement.

## Track a payment

Save the submitted transaction ID. Check execution success before crediting the destination. For contract calls, reconcile token balances or indexed transfer entries as well as the transaction result.

Blockbook can lag behind the node. If a transaction is visible through `client().transaction(txid)` but absent from history, check indexer synchronization before retrying a payment.

For pagination and exclusive timestamp bounds, see [Transaction lifecycle](../shared/transactions.md#read-apis).
