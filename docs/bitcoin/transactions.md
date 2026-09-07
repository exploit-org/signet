# Bitcoin Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Intents](#intents)
- [Pay one recipient](#pay-one-recipient)
- [Pay several recipients](#pay-several-recipients)
- [Include the fee in a budget](#include-the-fee-in-a-budget)
- [Sign and submit](#sign-and-submit)
- [Fees and operational cases](#fees-and-operational-cases)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.signet.bitcoin.BitcoinProvider;
import org.exploit.signet.bitcoin.model.account.descriptor.BitcoinAccountDescriptor;
import org.exploit.signet.bitcoin.model.intent.BitcoinMultiTransfer;
import org.exploit.signet.bitcoin.model.intent.BitcoinTransfer;
import org.exploit.signet.bitcoin.model.transaction.BitcoinTransaction;
import org.exploit.signet.bitcoin.model.transaction.BitcoinUnsignedTransaction;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;

import java.math.BigInteger;
import java.util.List;
```

</details>

## Intents

`BitcoinTransfer` has `recipient`, `withFee`, `confirmedOnly`, `feeLimit`, and `estimateMode` fields. The short constructor takes a recipient and `withFee`; it selects confirmed UTXOs and `CONSERVATIVE` estimation without a caller fee cap.

`BitcoinMultiTransfer` takes a recipient list and optionally the confirmation filter, fee limit, and estimate mode. It pays one network fee for the transaction's selected inputs and outputs.

The factory's default confirmation target is six blocks. Its default minimum change is 546 satoshis. Change below that threshold can be absorbed into the fee, which is still checked against `feeLimit`.

## Pay one recipient

This prepares 100,000 satoshis with a maximum fee of 10,000 satoshis:

```java
public static BitcoinUnsignedTransaction preparePayment(
        BitcoinProvider bitcoin,
        Account<Secp256k1PointOps> sender,
        BitcoinAccountDescriptor descriptor,
        String destination
) {
    var transfer = new BitcoinTransfer(
            new Recipient(destination, BigInteger.valueOf(100_000)),
            false,
            true,
            BigInteger.valueOf(10_000)
    );

    return bitcoin.transactions().factory().create(sender, transfer, descriptor);
}
```

The factory orders available UTXOs by descending value, selects enough inputs, estimates transaction virtual size, and adds change when it reaches the configured minimum. It validates that returned UTXOs belong to the source script and rejects duplicate outpoints.

Inspect `unsigned.transaction().inputs()`, `outputs()`, and `unsigned.fee()` before signing. Its fee is an `OptionalLong` in satoshis. Keep the `BitcoinUnsignedTransaction`, including its `signingInputs()`, for the signing step.

## Pay several recipients

```java
public static BitcoinUnsignedTransaction prepareBatch(
        BitcoinProvider bitcoin,
        Account<Secp256k1PointOps> sender,
        BitcoinAccountDescriptor descriptor,
        String first,
        String second
) {
    var transfer = new BitcoinMultiTransfer(
            List.of(
                    new Recipient(first, BigInteger.valueOf(100_000)),
                    new Recipient(second, BigInteger.valueOf(200_000))
            ),
            true,
            BigInteger.valueOf(20_000)
    );

    return bitcoin.transactions().factory().create(sender, transfer, descriptor);
}
```

Recipient values are preserved. The sender covers their sum plus the transaction fee. Coordinate UTXO selection between requests to avoid preparing two transactions against the same outpoints.

## Include the fee in a budget

```java
public static BitcoinUnsignedTransaction prepareBudgetPayment(
        BitcoinProvider bitcoin,
        Account<Secp256k1PointOps> sender,
        BitcoinAccountDescriptor descriptor,
        String destination,
        BigInteger budget
) {
    var transfer = new BitcoinTransfer(new Recipient(destination, budget), true);

    return bitcoin.transactions().factory().create(sender, transfer, descriptor);
}
```

The destination receives `budget - fee`. To sweep funds, pass the spendable balance for the selected address and confirmation policy. Balances for other address types derived from the same key are separate UTXO sets.

## Sign and submit

```java
public static Receipt submit(
        BitcoinProvider bitcoin,
        Account<Secp256k1PointOps> sender,
        BitcoinUnsignedTransaction unsigned
) {
    var signed = (BitcoinTransaction) bitcoin.signer().sign(sender, unsigned);

    return bitcoin.transactions().broadcaster().broadcast(signed);
}
```

The signing result is `BitcoinTransaction`. Its `dump()` is the serialized transaction; `txid()` and `wtxid()` identify the base and witness serialization respectively.

The broadcaster returns after submission. Use indexed history or block reads to establish inclusion and the confirmation depth required by your application.

The supplied Blockbook broadcaster leaves `Receipt.fee()` null. Use the prepared transaction's fee or reconstruct it from input values and outputs.

## Fees and operational cases

- `confirmedOnly=false` allows the explorer to return unconfirmed outputs. The service must decide whether spending them is acceptable.
- Fee estimation can be unavailable on a new or inactive node. Configure a suitable `BitcoinFeeEstimator` for that environment.
- An insufficient balance, an invalid explorer response, or a fee above the cap prevents preparation.
- Parsing raw transaction bytes does not reconstruct previous-output values. Keep that context if the application needs to verify a fee after parsing.

Executable scenarios: [BitcoinPaymentsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/bitcoin/BitcoinPaymentsTest.java) and [BitcoinSpendingSafetyTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/bitcoin/BitcoinSpendingSafetyTest.java).
