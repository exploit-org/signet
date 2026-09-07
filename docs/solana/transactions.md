# Solana Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Intents](#intents)
- [Send SOL](#send-sol)
- [Send several native payments](#send-several-native-payments)
- [Send SPL tokens](#send-spl-tokens)
- [Fees and rent](#fees-and-rent)
- [Sign and submit](#sign-and-submit)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.solana.SolanaProvider;
import org.exploit.signet.solana.model.intent.SPLTokenTransfer;
import org.exploit.signet.solana.model.intent.SolanaMultiTransfer;
import org.exploit.signet.solana.model.intent.SolanaTransfer;
import org.exploit.signet.solana.model.transaction.SolanaRawTransaction;
import org.exploit.signet.solana.model.transaction.SolanaSignedTransaction;
import org.exploit.signet.solana.model.transaction.SolanaUnsignedTransaction;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.signature.Signable;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
```

</details>

## Intents

- `SolanaTransfer(recipient, withFee, feeLimit)` sends SOL. The short constructor defaults to paying fees separately.
- `SolanaMultiTransfer(recipients, feeLimit)` places native transfers into one message.
- `SPLTokenTransfer(mint, recipient, sourceAccount, destinationAccount, memo, feeLimit)` sends tokens. The recipient's address is the destination owner. Token account addresses are separate optional fields.

Network fee caps use lamports. Token transfer amounts use atomic mint units.

## Send SOL

```java
public static SolanaUnsignedTransaction preparePayment(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        String destination
) {
    var amount = solana.converter().toAtomicAmount(new BigDecimal("0.01"));

    var intent = new SolanaTransfer(
            new Recipient(destination, amount),
            false,
            BigInteger.valueOf(100_000)
    );

    return solana.transactions().factory().create(sender, intent, null);
}
```

Preparation obtains a recent blockhash, simulates the message, determines a compute limit, queries the network fee, and simulates the final message. Without an explicit compute limit, the factory adds a 10% margin to simulated consumption, bounded by the program's maximum.

`withFee=true` subtracts the estimated network fee from the native recipient amount. It requires the sender to be the fee payer.

## Send several native payments

```java
public static SolanaUnsignedTransaction prepareBatch(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        List<Recipient> recipients
) {
    return solana.transactions().factory().create(
            sender,
            new SolanaMultiTransfer(recipients),
            null
    );
}
```

Each recipient becomes a System Program transfer instruction in the same transaction. Transaction packet and account limits still apply. Use separate transactions when a recipient set exceeds those limits.

## Send SPL tokens

Pass the mint address to the converter to use the token's on-chain decimals.
See [conversion by mint](README.md#amount-conversion-by-mint) for both directions
and how these overloads differ from native SOL conversion.

```java
public static SolanaUnsignedTransaction prepareTokenPayment(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        String mint,
        String destinationOwner
) {
    var amount = solana.converter().toAtomicAmount(mint, new BigDecimal("12.50"));
    var intent = new SPLTokenTransfer(
            mint,
            new Recipient(destinationOwner, amount),
            "invoice-1042"
    );

    return solana.transactions().factory().create(sender, intent, null);
}
```

The factory derives associated token accounts when explicit accounts are absent. It creates a missing destination associated token account idempotently and includes its rent reserve. An explicit destination token account must already exist.

The source account must belong to the sender and use the selected mint and token program. The destination account must belong to the recipient owner. Frozen accounts are rejected.

Token-2022 support includes transfer-fee configuration on the mint and transfer-fee amount, immutable owner, and required memo account extensions. Unsupported extensions cause `UNSUPPORTED_TOKEN_EXTENSION`.

For a transfer-fee mint, the requested amount is the gross token debit. The recipient's usable credit can be lower after the token fee. A destination requiring a memo must receive one.

## Fees and rent

`unsigned.fee()` is the estimated network fee. `unsigned.context().rentReserve()` records rent reserved by the high-level token preparation path. Neither the intent fee cap nor `options.maxFee()` includes rent or Token-2022 fees charged in tokens.

Both fee caps are checked when provided. Keep sufficient lamports in the fee payer for fee plus account creation costs.

## Sign and submit

For a single sender, pass `List.of(sender)` to this method. For sponsorship, pass every required signer once, including the fee payer:

```java
public static SolanaSignedTransaction sign(
        SolanaProvider solana,
        SolanaUnsignedTransaction unsigned,
        List<Account<Ed25519PointOps>> signers
) {
    SolanaRawTransaction transaction = unsigned;
    for (var signer : signers)
        transaction = (SolanaRawTransaction) solana.signer().sign(signer, (Signable) transaction);

    return (SolanaSignedTransaction) transaction;
}
```

The signer returns a partial transaction until all required signatures are present. The final cast assumes the supplied list contains all required signers. The signatures must cover the same message bytes.

```java
public static Receipt submit(
        SolanaProvider solana,
        SolanaSignedTransaction signed
) {
    return solana.transactions().broadcaster().broadcast(signed);
}
```

The broadcaster checks known blockhash expiry and sends the transaction with preflight enabled. The submission ID is the first signature. Track [status and execution](blocks-and-history.md) before crediting a payment.

`dump()` contains the base64 wire transaction. Store the transaction context separately when crossing process boundaries; parsing the dump cannot recover the local fee estimate, rent estimate, or last valid block height.
