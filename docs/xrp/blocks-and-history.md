# XRP Ledgers and History

[Connection](README.md) · [Examples index](../examples/README.md)

```java
public static void inspect(
        XrpProvider<?> xrp,
        String txid,
        String address,
        long afterMs
) {
    var transaction = xrp.transactions().api().getTransaction(txid);
    if (transaction == null || !transaction.validated())
        return;

    var ledger = xrp.blocks().api().getBlock(transaction.ledgerIndex());
    var page = xrp.transactions().api().getTransactions(transaction.ledgerIndex(), 1, 100);
    var history = xrp.transactions().api().getTransactions(address, afterMs);

    System.out.println(transaction.successful());
    System.out.println(transaction.result());
    System.out.println(ledger.hash());
    System.out.println(page);
    System.out.println(history);
}
```

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.xrp.XrpProvider;
```

</details>

## Ledger API

`blocks().api().getLatestBlockHeight()` returns the latest validated ledger index. `getBlock(index)` returns an `XrpBlock` with ledger hash, parent hash, and close timestamp converted to Unix milliseconds.

Use `client.ledger(index, true)` for a raw ledger response with transactions. Missing retained ledgers can make a requested block unavailable.

## Transaction result

`getTransaction(txid)` returns `XrpIndexedTransaction` or `null` when unavailable. Inspect `validated()`, `successful()`, `result()`, `ledgerIndex()`, and `fee()`.

For a validated Batch, the transaction API loads the ledger and associates inner transactions by `ParentBatchID`. Use `innerTransactions()` when accounting for individual batch payments.

An outer Batch result of `tesSUCCESS` alone does not prove its payments executed. `successful()` also requires the complete set of successful inner transactions.

A submitted transaction can remain queued or pending. Keep checking the submitted ID until it is validated or its ledger bound has passed, using the node's retained history to resolve the outcome.

## History and pagination

- `getTransactions(ledgerIndex, page, limit)` slices ledger entries and returns successful mapped transactions.
- `getTransactions(address, searchAfterMs)` scans validated account history with an exclusive Unix-millisecond lower bound.
- The address scan pins a maximum validated ledger, rejects duplicate or nonadvancing pages, and is bounded at 10,000 pages.

For explicit cursors, use `client.accountTransactions(address, minLedger, maxLedger, marker, limit)`. Persist the returned marker with the ledger range. An empty successful-transaction page can occur before the end of raw ledger entries.
