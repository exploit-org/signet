# Solana

Artifact: `org.exploit.signet:solana`.

- [Transactions and intents](transactions.md)
- [Slots, status, and history](blocks-and-history.md)
- [Programs, versioned messages, and durable nonces](programs.md)
- [SOL and token amount conversion](#amount-conversion-by-mint)
- Examples are embedded in the transaction, program, and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.solana.SolanaProvider;
import org.exploit.signet.solana.client.SolanaRpcClient;
import org.exploit.signet.solana.model.rpc.SolanaCommitment;

import java.math.BigDecimal;
import java.math.BigInteger;
```

</details>

## Connect

The provider supplies a transaction API directly over Solana RPC:

```java
public static long readTip(String rpcUrl) {
    try (var rpc = SolanaRpcClient.builder()
            .baseUrl(rpcUrl)
            .commitment(SolanaCommitment.FINALIZED)
            .build()) {
        var solana = new SolanaProvider(rpc);

        return solana.blocks().api().getLatestBlockHeight();
    }
}
```

The client defaults to `CONFIRMED`; the example selects `FINALIZED`. `PROCESSED` can be used for supported state reads, but the client's history methods require confirmed or finalized commitment.

The builder accepts `authorization(...)` and `jettyx(...)` for an existing transport. Close the RPC client after the provider is no longer used.

## Accounts and units

Solana accounts use Ed25519 keys. Load the [native libraries](../getting-started/README.md#native-libraries) before generating keys or signing. `solana.accounts().address().getPublicAddress(account)` returns the Base58 public key.

SOL amounts use lamports, with nine decimals. Token amounts use the mint's decimals. `solana.converter().toAtomicAmount(mint, displayAmount)` obtains the mint metadata through RPC.

The module supports legacy and v0 messages, address lookup tables, additional signers, a separate fee payer, durable nonces, SOL transfers, and selected SPL Token and Token-2022 operations.

## Amount conversion by mint

`SolanaProvider.converter()` returns `SolanaUnitConverter`. It supports native SOL
and token amounts through separate overloads:

| Method | Conversion | Decimals |
| --- | --- | --- |
| `toAtomicAmount(amount)` | SOL to lamports | 9, without RPC |
| `toDisplayAmount(amount)` | Lamports to SOL | 9, without RPC |
| `toAtomicAmount(mint, amount)` | Display token amount to atomic units | Read from the mint through RPC |
| `toDisplayAmount(mint, amount)` | Atomic token units to a display amount | Read from the mint through RPC |

Pass the **mint address**, not the owner's wallet address or a token account
address. The client must connect to the network where that mint exists.

### Convert token amounts in both directions

```java
public static void convertTokenAmount(SolanaProvider solana, String mint) {
    var converter = solana.converter();
    var atomic = converter.toAtomicAmount(
            mint,
            new BigDecimal("12.50")
    );
    var display = converter.toDisplayAmount(
            mint,
            atomic
    );

    System.out.println("Atomic units: " + atomic);
    System.out.println("Display amount: " + display.toPlainString());
}
```

For a mint with six decimals, `12.50` becomes `12_500_000` atomic units. A mint with
nine decimals produces `12_500_000_000`. Each mint overload reads the mint metadata;
it does not assume a fixed token precision. SPL Token and supported Token-2022
mints use the same API. Unsupported mint extensions are rejected.

Use decimal strings when constructing `BigDecimal`. Conversion is exact: an amount
with more fractional precision than the mint supports is rejected, without rounding.

### Display a token balance

```java
public static BigDecimal tokenBalance(
        SolanaProvider solana,
        String owner,
        String mint
) {
    var atomic = solana.accounts().balance().balanceOf(owner, mint);

    return solana.converter().toDisplayAmount(mint, atomic);
}
```

Conversion changes the unit only. It does not deduct network fees, account rent,
or Token-2022 transfer fees. See [token transfers](transactions.md#send-spl-tokens)
for how those costs affect a payment.

### Convert native SOL

```java
public static void convertSol(SolanaProvider solana) {
    var lamports = solana.converter().toAtomicAmount(new BigDecimal("0.01"));
    var sol = solana.converter().toDisplayAmount(BigInteger.valueOf(10_000_000));

    System.out.println(lamports); // 10000000
    System.out.println(sol.toPlainString()); // 0.010000000
}
```

Keep the converter's concrete type (`var` or `SolanaUnitConverter`) when using the
mint overloads. A variable declared as the shared `UnitConverter` exposes only
the two native-amount methods.
