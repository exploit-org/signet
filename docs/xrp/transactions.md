# XRP Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Payment intent](#payment-intent)
- [Fee and lifetime policy](#fee-and-lifetime-policy)
- [Atomic XRP batch](#atomic-xrp-batch)
- [Sign and submit](#sign-and-submit)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.ecc.spi.point.PointOps;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
import org.exploit.signet.xrp.XrpProvider;
import org.exploit.signet.xrp.client.XrpRpcClient;
import org.exploit.signet.xrp.model.intent.XrpMultiTransfer;
import org.exploit.signet.xrp.model.intent.XrpTransfer;
import org.exploit.signet.xrp.model.transaction.XrpSignedTransaction;
import org.exploit.signet.xrp.model.transaction.XrpTransactionOptions;
import org.exploit.signet.xrp.model.transaction.XrpUnsignedTransaction;
import org.exploit.signet.xrp.transaction.factory.XrpTransactionFactory;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
```

</details>

## Payment intent

`XrpTransfer` contains `recipient`, `destinationTag`, `sourceTag`, `withFee`, and `feeLimit`. Tags are optional unsigned 32-bit values represented as `Long`.

The short constructor pays fees separately and uses no tags. This example sends 10 XRP with a caller-supplied destination tag:

```java
public static <P extends PointOps<P>> XrpUnsignedTransaction preparePayment(
        XrpProvider<P> xrp,
        Account<P> sender,
        String destination,
        Long destinationTag
) {
    var amount = xrp.converter().toAtomicAmount(new BigDecimal("10"));

    var intent = new XrpTransfer(new Recipient(destination, amount), destinationTag);

    return xrp.transactions().factory().create(sender, intent);
}
```

Preparation reads ledger state, the sender's sequence, the current fee, and destination requirements. It rejects an unfunded sender, a disabled master key, a payment to the sender itself, a missing required destination tag, and insufficient funds for payment, fee, and reserves.

The generated Payment includes `LastLedgerSequence` to bound its lifetime. Serialize preparation per account and track submitted sequences while waiting for validation.

## Fee and lifetime policy

The default `XrpTransactionOptions` caps fees at 1,000 drops and sets `LastLedgerSequence` to the reference ledger index plus 20. Override both when building the transaction factory:

```java
public static XrpProvider<Secp256k1PointOps> withFeePolicy(XrpRpcClient rpc) {
    var options = new XrpTransactionOptions(BigInteger.valueOf(500), 10);
    var factory = new XrpTransactionFactory<Secp256k1PointOps>(rpc, options);

    return XrpProvider.builder()
            .client(rpc)
            .transactionFactory(factory)
            .build();
}
```

An intent fee cap is checked in addition to the factory cap. `withFee=true` subtracts the transaction fee from the requested recipient amount, while preserving the sender reserve check.

## Atomic XRP batch

`XrpMultiTransfer` contains 2 through 8 `XrpTransfer` values and a batch-level fee cap:

```java
public static <P extends PointOps<P>> XrpUnsignedTransaction prepareBatch(
        XrpProvider<P> xrp,
        Account<P> sender,
        String first,
        String second
) {
    var intent = new XrpMultiTransfer(
            List.of(
                    new XrpTransfer(new Recipient(first, BigInteger.valueOf(10_000_000)), 1042L),
                    new XrpTransfer(new Recipient(second, BigInteger.valueOf(20_000_000)))
            ),
            BigInteger.valueOf(1_000)
    );

    return xrp.transactions().factory().create(sender, intent);
}
```

The node's ledger must enable `BatchV1_1`. The factory checks the amendment and reports `BATCH_NOT_ENABLED` when unavailable. This documents the module's capability, without assuming activation on a particular public network.

The generated batch uses `ALL_OR_NOTHING`, one sender, and consecutive inner sequences. Inner payments have zero fees. Their `withFee` must be false and their individual `feeLimit` must be null.

The batch fee estimate is the node fee multiplied by the payment count plus two. The sender must retain its reserve and fund all payments. A failed atomic batch can still charge the outer transaction fee.

## Sign and submit

```java
public static <P extends PointOps<P>> Receipt submit(
        XrpProvider<P> xrp,
        Account<P> sender,
        XrpUnsignedTransaction unsigned
) {
    var signed = (XrpSignedTransaction) xrp.signer().sign(sender, unsigned);

    return xrp.transactions().broadcaster().broadcast(signed);
}
```

The broadcaster rejects a known expired `LastLedgerSequence`. It accepts node results `tesSUCCESS` and `terQUEUED` only when the response also marks the submission accepted.

Both results require subsequent ledger validation. Query the transaction and check `validated()` and `successful()` before settling the payment. The [history page](blocks-and-history.md) shows this read path.

Executable scenarios: [XrpPaymentsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/xrp/XrpPaymentsTest.java) and the [XRP functional suites](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/xrp).
