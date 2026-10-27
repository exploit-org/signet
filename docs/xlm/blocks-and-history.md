# Stellar ledgers and transaction results

[Connection](README.md) · [Transactions](transactions.md)

## Submit and confirm

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.xlm.XlmProvider;
import org.exploit.signet.xlm.model.transaction.XlmSignedTransaction;
import org.exploit.signet.xlm.model.transaction.XlmUnsignedTransaction;

public static Receipt submit(XlmProvider xlm, Account<Ed25519PointOps> account,
        XlmUnsignedTransaction transaction) {
    var signed = (XlmSignedTransaction) xlm.signer().sign(account, transaction);
    return xlm.transactions().broadcaster().broadcast(signed);
}
```

The broadcaster accepts RPC `PENDING` and `DUPLICATE` statuses. A receipt contains
the submitted hash and maximum fee budget; it does not confirm execution. Query
`xlm.transactions().api().getTransaction(hash)` with a bounded wait until it returns
an indexed transaction, then inspect `successful()` and `result()`.

`XlmIndexedTransaction.fee()` reports the actual charged fee. `transaction()` retains
the full submitted envelope, `result()` returns the protocol result, and `metadata()`
exposes ledger changes and events when the endpoint provides transaction metadata.

An admission rejection consumes no sequence or fee. A transaction included in a
ledger can fail, charge a fee and consume its source sequence while rolling back
all operation effects. Resolve an uncertain submission using the original hash
and signed envelope; creating another payment with a new sequence may pay twice.

## Ledgers and history

`blocks().api().getLatestBlockHeight()` reads the latest ingested ledger.
`getBlock(height)` returns its verified header hash, close time and protocol version.
`transactions().api().getTransactions(height, page, limit)` reads transactions from
one ledger, including failed executions. Page numbers start at 1; limits are 1–200.

Stellar RPC retains a bounded history and has no account transaction index.
`getTransaction(hash)` returns null for `NOT_FOUND`; this can mean pending,
unseen or outside retention. Missing history is not proof of failed execution.
Requests outside the RPC's retained ledger range propagate its error.

The default `XlmRpcTransactionApi.getTransactions(address, searchAfterMs)` reports
`XLM_HISTORY_UNAVAILABLE`. Configure `XlmProvider.Builder.transactionApi(...)`
with an `XlmTransactionApi` backed by an account indexer when that query is required.
