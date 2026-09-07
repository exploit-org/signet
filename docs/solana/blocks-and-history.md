# Solana Slots, Status, and History

[Connection](README.md) · [Examples index](../examples/README.md)

```java
public static void inspect(
        SolanaProvider solana,
        long slot,
        String signature,
        String address,
        long afterMs
) {
    var block = solana.blocks().api().getBlock(slot);
    var status = solana.client().signatureStatus(signature);
    var transaction = solana.transactions().api().getTransaction(signature);
    var page = solana.transactions().api().getTransactions(slot, 1, 100);
    var history = solana.transactions().api().getTransactions(address, afterMs);

    System.out.println(block);
    System.out.println(status);
    System.out.println(transaction);
    System.out.println(page);
    System.out.println(history);
}
```

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.solana.SolanaProvider;
```

</details>

## Slots and block heights

`blocks().api().getLatestBlockHeight()` returns `client.slot()`. Its value is a slot number. Pass a slot to `getBlock(slot)` and `getTransactions(slot, page, limit)`.

`SolanaBlock` retains the slot, optional produced block height, blockhash, previous blockhash, parent slot, and optional Unix-millisecond timestamp. `client.blockHeight()` reads produced block height, which is also the unit used by recent-blockhash expiry.

A block can be unavailable at the configured commitment. The block summary API returns `null` when RPC returns null. Node errors can also indicate skipped or unavailable slots. Block transaction reads reject an unavailable block.

## Submission status

`client.signatureStatus(signature)` reads status. `transactions().api().getTransaction(signature)` returns an indexed transaction once available. Check `successful()` and the status confirmation level before treating the payment as complete. Raw transaction metadata is available through `client.transaction(signature)`.

The indexed representation includes network fee and execution metadata. Token deltas and inner instructions can be relevant when reconciling program-driven payments.

## History

Block and address history return successful transactions. Individual transaction lookup can expose a failed transaction for diagnostics.

Address history scans `getSignaturesForAddress`, loads matching transactions, and applies an exclusive timestamp bound. A required transaction that has been pruned causes an error instead of silently disappearing from the result.

The convenience scan is bounded at 10,000 pages. For large histories, use `client.signaturesForAddress(address, beforeSignature, limit)` and persist the signature cursor. Limits are 1 through 1,000.

Remember that success filtering occurs after block pagination. An empty filtered page does not prove that the requested block has no later transactions.
