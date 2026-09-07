# Solana Programs and Transaction Options

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Compose instructions](#compose-instructions)
- [Sponsored v0 payment](#sponsored-v0-payment)
- [Durable nonce](#durable-nonce)
- [Token program scenarios](#token-program-scenarios)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.solana.SolanaProvider;
import org.exploit.signet.solana.model.intent.SolanaTransfer;
import org.exploit.signet.solana.model.transaction.SolanaTransactionOptions;
import org.exploit.signet.solana.model.transaction.SolanaUnsignedTransaction;
import org.exploit.signet.solana.program.MemoProgram;
import org.exploit.signet.solana.program.SystemProgram;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;

import java.math.BigInteger;
import java.util.List;
```

</details>

## Compose instructions

Pass a list of `SolanaInstruction` values to the factory. A transfer with a memo uses:

```java
public static SolanaUnsignedTransaction prepareMemoPayment(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        String destination
) {
    var from = solana.accounts().address().getPublicAddress(sender);
    var instructions = List.of(
            SystemProgram.transfer(from, destination, BigInteger.valueOf(1_000_000)),
            MemoProgram.memo("invoice-1042", from)
    );

    return solana.transactions().factory().create(sender, instructions);
}
```

Each instruction names a program, ordered account metadata, and instruction data. For custom programs, encode the program's instruction schema and set signer/writable flags through `SolanaAccountMeta`.

Available helpers:

- `SystemProgram`: transfers, account creation, and nonce account operations.
- `MemoProgram`: UTF-8 memo instructions with optional required signers.
- `TokenProgram`: checked transfers, approvals, revoke, mint, burn, freeze/thaw, account close, native token synchronization, multisig initialization, and supported Token-2022 helpers.
- `AssociatedTokenProgram`: associated address derivation and idempotent account creation.
- `ComputeBudgetProgram`: compute unit limit and unit price.
- `AddressLookupTableProgram`: lookup table lifecycle instructions.

Raw instruction composition does not infer every account-creation rent requirement. Fund the accounts required by your program and check simulation results.

## Sponsored v0 payment

Use `SolanaTransactionOptions` to select a fee payer, versioned message, lookup tables, compute budget, and fee cap:

```java
public static SolanaUnsignedTransaction prepareSponsoredPayment(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        String destination,
        String sponsor,
        String lookupTable
) {
    var options = SolanaTransactionOptions.builder()
            .feePayer(sponsor)
            .versioned(true)
            .lookupTables(List.of(lookupTable))
            .computeUnitPrice(BigInteger.valueOf(1_000))
            .maxFee(BigInteger.valueOf(100_000))
            .build();

    var intent = new SolanaTransfer(new Recipient(destination, BigInteger.valueOf(1_000_000)));

    return solana.transactions().factory().create(sender, intent, null, options);
}
```

The sponsor needs lamports and must sign. The sender also signs the transfer. The lookup table must already exist, and its extension must be finalized and warmed up. Lookup tables require `versioned(true)`.

`computeUnitPrice` is expressed in micro-lamports per compute unit. `maxFee` is a total network fee cap in lamports. The default price is zero; the factory does not select a market priority price automatically. Read `client().recentPrioritizationFees(writableAccounts)` to inform an application policy.

Provide a compute limit or price through options or through explicit Compute Budget instructions. Supplying the same setting twice is rejected.

## Durable nonce

For a workflow where signing may outlive a recent blockhash, use an existing initialized nonce account:

```java
public static SolanaUnsignedTransaction prepareNoncePayment(
        SolanaProvider solana,
        Account<Ed25519PointOps> sender,
        String destination,
        String nonceAccount
) {
    var options = SolanaTransactionOptions.builder()
            .nonceAccount(nonceAccount)
            .build();

    var intent = new SolanaTransfer(new Recipient(destination, BigInteger.valueOf(1_000_000)));

    return solana.transactions().factory().create(sender, intent, null, options);
}
```

The factory loads the stored nonce and inserts its advance instruction first. Include the nonce authority among the required signers. Do not add another nonce advance instruction to the same message.

Once the nonce is consumed, transactions signed against its previous value cannot execute. Query transaction status before preparing a replacement after a submission timeout.

## Token program scenarios

For delegated spending, create an `approveChecked` instruction from the token owner, submit and confirm it, then use `transferChecked` with the delegate authority. For multisig token ownership, pass the multisig account as authority and provide the required signer addresses through the helper's signer arguments.

For wrapped SOL, create or locate the native-mint token account, fund it, and call `syncNative`. Closing the account returns its remaining lamports to the selected destination.

Program, token, multisigner, lookup-table, and nonce scenarios are exercised in the [Solana functional suites](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/solana).
