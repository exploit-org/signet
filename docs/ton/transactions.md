# TON Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Intents](#intents)
- [Send TON](#send-ton)
- [Highload V3](#highload-v3)
- [Fees and wallet state](#fees-and-wallet-state)
- [Sign and submit](#sign-and-submit)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
import org.exploit.signet.ton.TonProvider;
import org.exploit.signet.ton.constant.TonNetwork;
import org.exploit.signet.ton.constant.TonWalletVersion;
import org.exploit.signet.ton.model.account.descriptor.TonAccountDescriptor;
import org.exploit.signet.ton.model.intent.TonTransfer;
import org.exploit.signet.ton.model.transaction.TonSignedTransaction;
import org.exploit.signet.ton.model.transaction.TonUnsignedTransaction;

import java.math.BigDecimal;
import java.math.BigInteger;
```

</details>

## Intents

- `TonTransfer(recipient, comment, bounce, feeLimit)` sends native TON. Short constructors accept just a recipient or a recipient and comment.
- `TonCall` sends a contract payload with attached TON and optional destination StateInit. [Contract and Jetton helpers](contracts.md) produce these calls.

Amounts and fee limits use nanotons. Values must be positive and fit TON's
`VarUInteger 16` amount field. There is one outgoing message per prepared call;
this API does not implement Highload batches or multiple recipients.

## Send TON

The sender must be funded at the address derived with the supplied descriptor:

```java
public static TonUnsignedTransaction preparePayment(
        TonProvider ton,
        Account<Ed25519PointOps> sender,
        TonAccountDescriptor descriptor,
        String destination
) {
    var amount = ton.converter().toAtomicAmount(new BigDecimal("0.25"));
    var intent = new TonTransfer(
            new Recipient(destination, amount),
            "invoice-1042",
            null,
            BigInteger.valueOf(20_000_000)
    );

    return ton.transactions().factory().create(sender, intent, descriptor);
}
```

Use a V3, V4, or V5 descriptor with this overload. Highload V3 requires an explicit
query ID as shown below. The example caps the estimated sender fee at `0.02 TON`;
choose a cap appropriate for your operation.

A null `bounce` follows the friendly address's bounceable flag. Raw addresses
default to non-bounceable delivery. An explicit boolean overrides that choice.
Comments use the standard zero opcode and UTF-8 snake cells, with a 1024-byte
UTF-8 limit.

The first transfer from a funded, undeployed wallet includes its StateInit
automatically. Subsequent transfers use its deployed code and seqno. Derive and
fund the address before preparing the first transaction.

## Highload V3

Pass a caller-allocated query ID to the four-argument factory overload:

```java
public static TonUnsignedTransaction prepareHighloadPayment(
        TonProvider ton,
        Account<Ed25519PointOps> sender,
        String destination,
        int queryId
) {
    var descriptor = new TonAccountDescriptor(
            TonNetwork.TESTNET,
            TonWalletVersion.HIGHLOAD_V3
    );
    var intent = new TonTransfer(
            new Recipient(destination, BigInteger.valueOf(250_000_000))
    );

    return ton.transactions().factory().create(sender, intent, descriptor, queryId);
}
```

The query ID uses 23 bits: a 13-bit shift and a 10-bit bit number. Bit number 1023
is invalid. Allocate and persist IDs uniquely per wallet across concurrent senders
and the replay window. A contract payload's query ID is a separate value.

The factory backdates `createdAt` by up to 30 seconds to account for the node's
last block time. Expiry is `createdAt + descriptor.timeout()`. It checks whether
the query has already been processed; it does not reserve the ID.

Highload V3 supports direct calls to existing contracts. Its direct outgoing
message cannot contain destination StateInit; deploy that contract with V3/V4/V5
first. The sender Highload wallet can still deploy on its own first transfer.

## Fees and wallet state

Preparation reads account state, validates the descriptor against the deployed
wallet, selects seqno or query ID, estimates fees through TONAPI, and checks the
balance. V3/V4/V5 messages receive a 60-second lifetime. Serialize preparation
and submission per wallet to avoid competing uses of the same seqno.

`unsigned.fee()` is the prepared estimate. The broadcaster checks current wallet
state, expiry, balance, and a fresh estimate before sending. It returns that
estimate in `Receipt.fee()`.

Messages use send mode 3: the wallet pays fees separately from the outgoing
value. A recipient contract may consume part of that value during execution.
There is no `withFee` transfer option. `feeLimit` caps the estimate; it does not
encode an on-chain gas cap. Destination execution costs and bounces must be
reconciled from the resulting message chain.

## Sign and submit

Inspect `unsigned.call()`, `fee()`, and `expiresAt()` before signing. This method
submits the payment and returns its normalized external message hash:

```java
public static String submit(
        TonProvider ton,
        Account<Ed25519PointOps> sender,
        TonUnsignedTransaction unsigned
) {
    var signed = (TonSignedTransaction) ton.signer().sign(sender, unsigned);
    var messageHash = signed.hash();

    // Persist signed.dump() and messageHash before submitting in a durable application.
    var receipt = ton.transactions().broadcaster().broadcast(signed);
    System.out.println("Estimated sender fee: " + receipt.fee());

    return receipt.hash();
}
```

`signed.hash()` and `receipt.hash()` return the same normalized external message
hash. `unsigned.hash()` is null because the signature is not yet known. TON assigns
the executed transaction hash after processing the message. Persist `signed.dump()` and
`signed.hash()` before submission, and use [execution lookup](blocks-and-history.md#find-the-executed-transaction)
before preparing a replacement after a timeout.

For external signing, use `TonSigners.builder(externalEd25519Strategy).build()`
with the provider's `signer(...)` option. The raw strategy receives the wallet's
32-byte signing hash and returns `RawSignature` containing an `Ed25519Signature`.
Signet verifies the signature against the prepared wallet key.

Executable scenarios: [TonPaymentsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/ton/TonPaymentsTest.java).
