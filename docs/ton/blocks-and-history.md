# TON Blocks, Execution, and History

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Read blocks](#read-blocks)
- [Find the executed transaction](#find-the-executed-transaction)
- [Inspect execution](#inspect-execution)
- [Read history](#read-history)
- [Parse transaction data](#parse-transaction-data)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.ton.TonProvider;
import org.exploit.signet.ton.model.block.TonBlockId;
import org.exploit.signet.ton.model.transaction.TonTransaction;
import org.ton.ton4j.tlb.ComputePhaseVM;
import org.ton.ton4j.tlb.TransactionDescriptionOrdinary;
```

</details>

## Read blocks

`getLatestBlockHeight()` returns a masterchain seqno. Pass that value to
`getBlock(height)` to read the masterchain block. For a specific shard block,
provide its workchain, 16-character shard hex, and seqno:

```java
public static void inspectBlocks(TonProvider ton, TonBlockId shardId) {
    var height = ton.blocks().api().getLatestBlockHeight();
    var masterchain = ton.blocks().api().getBlock(height);
    var shard = ton.blocks().api().getBlock(shardId);
    var transactions = ton.transactions().api().getTransactions(shardId);

    System.out.println(masterchain);
    System.out.println(shard);
    System.out.println(transactions);
}
```

`TonBlock` retains the block ID, root hash, file hash, Unix-millisecond timestamp,
and network global ID. A masterchain seqno is not a global transaction height;
shard chains have their own positions. A missing block lookup returns null on
TONAPI HTTP 404. Exact-block transaction reads report backend errors.

## Find the executed transaction

The signed external message and its executed transaction have different hashes.
`signed.hash()` and `receipt.hash()` return the normalized external message hash.
Query TONAPI's message index after submission:

```java
public static TonTransaction findExecution(TonProvider ton, String messageHash) {
    return ton.transactions().api().getTransactionByMessage(messageHash);
}
```

This is a single read, not a wait. A null result means the lookup returned HTTP
404; it does not establish rejection. Poll with an application deadline and retain
the submitted message identity. Once known, the executed transaction hash can be
passed to `getTransaction(txid)`. Hash arguments use 32-byte hex strings.

Index availability depends on the TONAPI deployment. OpenTonAPI's lightweight
storage does not implement message-hash lookup and indexes only configured
accounts. Its local test fixture instead follows the incoming normalized message
hash through `client.transactions(address, limit)`.

## Inspect execution

`TonTransaction.data()` returns the ton4j TL-B transaction, including compute and
action phases and incoming/outgoing messages. For an ordinary transaction:

```java
public static void inspectExecution(TonTransaction transaction) {
    var data = transaction.data();

    System.out.println("Transaction: " + transaction.hash());
    System.out.println("Fee: " + transaction.fee());

    if (data.getDescription() instanceof TransactionDescriptionOrdinary ordinary) {
        System.out.println("Aborted: " + ordinary.isAborted());

        if (ordinary.getComputePhase() instanceof ComputePhaseVM compute) {
            System.out.println("Compute success: " + compute.isSuccess());
            System.out.println("Exit code: " + compute.getDetails().getExitCode());
        }

        if (ordinary.getActionPhase() != null) {
            System.out.println("Action success: " + ordinary.getActionPhase().isSuccess());
        }
    }

    for (var message : data.getInOut().getOutMessages()) {
        System.out.println("Destination: " + message.getInfo().getDestinationAddress());
    }
}
```

Compute can be skipped, and action phase can be absent. Inspect both phases and
aborted state when deciding whether the sender executed successfully. Follow
outgoing internal messages to their destination transactions; a successful wallet
send does not prove a contract call or Jetton transfer succeeded.

The transaction fee excludes value sent to recipients. For a mode-3 wallet send,
reconcile the outgoing value, transaction fee, and remaining forwarding fee in
the internal message. The destination can charge its own compute/storage fees,
send further messages, or bounce value. TONAPI's `TonApiClient.emulate(signed)`
exposes an estimated trace; actual execution determines settlement.

## Read history

```java
public static void inspectHistory(
        TonProvider ton,
        long masterchainSeqno,
        String address,
        long afterMs
) {
    var interval = ton.transactions().api().getTransactions(masterchainSeqno, 1, 100);
    var history = ton.transactions().api().getTransactions(address, afterMs);

    System.out.println(interval);
    System.out.println(history);
}
```

`getTransactions(height, page, limit)` reads the shard interval referenced by the
masterchain block. Page numbers start at one; limits are 1 through 1,000. Use
`getTransactions(TonBlockId)` for all transactions in one exact block.

Address history applies an exclusive Unix-millisecond lower bound and traverses
pages with a `before_lt` cursor. It includes failed transactions. The convenience
scan rejects nonadvancing pages and is bounded at 10,000 pages.

For a persistent indexer, use `TonApiClient.transactions(address, beforeLt, limit)`
and retain the last transaction's logical time. Pass null for the first page and
use `transaction.data().getLt().longValueExact()` for the next cursor. The backend
must support that pagination; OpenTonAPI's lightweight local storage has more
limited history than the hosted service.

Deduplicate by executed transaction hash and keep block identity with your index
cursor. Multiple transactions share timestamps, and index updates can lag chain
execution. The provider exposes no configurable commitment level; define the
confirmation policy required by your application.

## Parse transaction data

```java
public static TonTransaction parseExecutedTransaction(TonProvider ton, String base64Boc) {
    return ton.transactions().parser().parse(base64Boc);
}
```

The parser accepts an **executed transaction BOC**. Use `transaction.dump()` from
a history result. `signed.dump()` is an external message BOC and is not valid
input for this parser. Each `data()` call decodes a fresh TL-B model.

Executable scenario: [TonApiTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/ton/TonApiTest.java).
