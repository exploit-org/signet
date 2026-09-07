# Bitcoin Blocks, History, and UTXOs

[Bitcoin connection](README.md) · [Transactions](transactions.md) · [All guides](../README.md)

Use the block API when you need every transaction in a block. Use address history
for activity associated with an address, and UTXOs for its currently unspent outputs.
All reads below use the configured `BitcoinExplorer`; the supplied implementation
is `BlockbookBitcoinExplorer`.

**On this page:**

- [Read a complete block](#read-a-complete-block)
- [Read the indexed tip](#read-the-indexed-tip)
- [Read transaction history](#read-transaction-history)
- [Read spendable outputs](#read-spendable-outputs)
- [Parse a transaction dump](#parse-a-transaction-dump)
- [Migration from the height-only model](#migration-from-the-height-only-model)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.bitcoin.BitcoinProvider;
import org.exploit.signet.bitcoin.model.block.BitcoinBlock;
import org.exploit.signet.bitcoin.model.transaction.BitcoinTransaction;
import org.exploit.signet.spi.transaction.Transactions;

import java.time.Instant;
```

</details>

## Read a complete block

`getBlock(height)` returns a `BitcoinBlock` with these fields:

| Field | Meaning |
| --- | --- |
| `height()` | Requested block height; genesis is height zero |
| `hash()` | Block hash as 64 hexadecimal characters, without `0x` |
| `timestampMs()` | Header time as a Unix timestamp in milliseconds |
| `transactions()` | Immutable list of all `BitcoinTransaction` values, in block order, including coinbase |

```java
public static void inspectBlock(
        BitcoinProvider bitcoin,
        long height
) {
    var block = bitcoin.blocks().api().getBlock(height);

    System.out.println("Height: " + block.height());
    System.out.println("Hash: " + block.hash());
    System.out.println("Time: " + Instant.ofEpochMilli(block.timestampMs()));
    System.out.println("Transactions: " + block.transactions().size());

    for (var transaction : block.transactions()) {
        System.out.println("Txid: " + transaction.txid());
        System.out.println("Witness txid: " + transaction.wtxid());

        for (var output : transaction.outputs()) {
            System.out.println("Satoshis: " + output.value());
            System.out.println("Script: " + output.scriptPubKey().hex());
        }
    }
}
```

The Blockbook adapter obtains the hash for the requested height, fetches that raw
block, and reuses the transaction parser. Reading a complete block takes two
indexer requests and does not page through transaction summaries or fetch each
transaction separately. Genesis is supported even when its coinbase is unavailable
through the transaction lookup endpoint.

The adapter checks the returned block hash; parsing checks the transaction Merkle root, encoded counts,
trailing data, and size/weight limits. These are response consistency checks;
confirmation and reorganization handling remain application responsibilities.
All parsed transactions carry the block's timestamp. Raw transaction bytes do not
contain the previous-output values needed to reconstruct transaction fees.

## Read the indexed tip

```java
public static BitcoinBlock latestBlock(BitcoinProvider bitcoin) {
    return bitcoin.blocks().api().getLatestBlock();
}
```

`getLatestBlockHeight()` reads Blockbook's indexed height. `getLatestBlock()` reads
that height and then loads its complete block. This is the indexed tip, which can
lag behind Bitcoin Core. For a cheap progress check, request only the height.

A negative height throws `IllegalArgumentException`. A missing hash or malformed
block response produces `SignetException` with `INVALID_EXPLORER_RESPONSE`;
transport and backend errors retain their own error codes. Block reads do not
return an empty placeholder when a block is unavailable.

## Read transaction history

Address history uses an **exclusive** Unix-millisecond lower bound:

```java
public static void inspectHistory(
        BitcoinProvider bitcoin,
        String address,
        long searchAfterMs
) {
    var transactions = bitcoin.transactions().api()
            .getTransactions(address, searchAfterMs);

    for (var transaction : transactions) {
        System.out.println(transaction.txid());
        System.out.println(Instant.ofEpochMilli(transaction.timestampMs()));
    }
}
```

Persist transaction IDs and rescan an overlapping timestamp window when indexing
continuously. Transactions can share timestamps, and Blockbook can index them later.

The separate `getTransactions(height, page, limit)` API uses **one-based** backend
pages. Blockbook controls page size; `limit` only truncates the chosen page. For
example, requesting 100 entries from each 1,000-entry backend page omits 900 entries
per page. Use `getBlock(height).transactions()` for a complete block, or the
[raw Blockbook page API](../blockbook/README.md) when you need page metadata.

## Read spendable outputs

```java
public static void inspectUtxos(
        BitcoinProvider bitcoin,
        String address
) {
    var outputs = bitcoin.transactions().api()
            .getUnspentOutputs(address, true);

    for (var output : outputs) {
        System.out.println(output.outPoint().txid());
        System.out.println(output.outPoint().outputIndex());
        System.out.println(output.value());
        System.out.println(output.scriptPubKey().hex());
        System.out.println(output.confirmations());
    }
}
```

`true` requests confirmed outputs only. Values are satoshis. The adapter verifies
the referenced output and script against its parsed parent transaction. An output
can be spent after this read; the factory does not reserve it for your application.

## Parse a transaction dump

```java
public static BitcoinTransaction parseTransaction(
        BitcoinProvider bitcoin,
        String dump
) {
    var transaction = bitcoin.transactions().parser().parse(dump);

    System.out.println(transaction.inputs());
    System.out.println(transaction.outputs());
    System.out.println(transaction.lockTime());
    System.out.println(transaction.weight());
    System.out.println(transaction.virtualSize());

    return transaction;
}
```

A standalone dump has no block timestamp or confirmation state. Use block or
transaction reads for that context. Keep previous-output information if you need
to calculate the fee after parsing.

## Migration from the height-only model

`BitcoinBlock(long height)` has been replaced by
`BitcoinBlock(long height, String hash, long timestampMs, List<BitcoinTransaction> transactions)`.
Custom `BitcoinBlocksApi` / `BitcoinExplorer` implementations must populate the new
fields. Existing callers that only use `block.height()` continue to work after
recompilation. The default `getLatestBlock()` delegates to the implementation's
`getLatestBlockHeight()` and `getBlock(height)`.
