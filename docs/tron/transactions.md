# TRON Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Intents](#intents)
- [Send TRX](#send-trx)
- [Send TRC20](#send-trc20)
- [Native fanout](#native-fanout)
- [Token fanout](#token-fanout)
- [Fanout with authorization](#fanout-with-authorization)
- [Sign and submit](#sign-and-submit)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.ecc.secp256k1.signature.Secp256k1ECDSASignature;
import org.exploit.ecc.spi.signature.RecoverableSignature;
import org.exploit.signet.evm.contract.Call;
import org.exploit.signet.evm.model.signature.EIP712Domain;
import org.exploit.signet.evm.model.signature.ERC3009ReceiveAuthorization;
import org.exploit.signet.evm.model.transaction.signature.EvmSignature;
import org.exploit.signet.evm.spi.signature.ERC3009Authorization;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.signature.RawSignature;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
import org.exploit.signet.tron.TronProvider;
import org.exploit.signet.tron.accounts.address.TronAddresses;
import org.exploit.signet.tron.model.intent.TRC20MultiTransfer;
import org.exploit.signet.tron.model.intent.TRC20Transfer;
import org.exploit.signet.tron.model.intent.TronMultiTransfer;
import org.exploit.signet.tron.model.intent.TronTransfer;
import org.exploit.signet.tron.model.transaction.TronSignedTransaction;
import org.exploit.signet.tron.model.transaction.TronUnsignedTransaction;
import org.web3j.abi.datatypes.Bool;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
```

</details>

## Intents

| Intent | Required fields | Optional fields |
| --- | --- | --- |
| `TronTransfer` | recipient | `withFee`, fee limit |
| `TRC20Transfer` | token contract, recipient | fee limit |
| `TronMultiTransfer` | Fanout contract, recipients | fee limit |
| `TRC20MultiTransfer` | Fanout contract, token contract, recipients | fee limit, ERC3009 authorization |

Native amounts and all network fee caps use sun. Token amounts use token atomic units. Transfer intents do not have an EVM chain ID field.

## Send TRX

```java
public static TronUnsignedTransaction preparePayment(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        String destination
) {
    var amount = tron.converter().toAtomicAmount(new BigDecimal("10"));
    var feeLimit = tron.converter().toAtomicAmount(new BigDecimal("2"));

    var intent = new TronTransfer(new Recipient(destination, amount), false, feeLimit);

    return tron.transactions().factory().create(sender, intent, null);
}
```

The factory asks the node to create the transaction and estimates its bandwidth charge, including account activation when applicable. It checks the sender's balance and the caller's fee cap.

Use `new TronTransfer(recipient, true, feeLimit)` to subtract the estimated fee from the recipient budget. That budget must exceed the fee.

## Send TRC20

```java
public static TronUnsignedTransaction prepareTokenPayment(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        String token,
        String destination
) {
    var amount = tron.converter().toAtomicAmount(token, new BigDecimal("12.50"));
    var intent = new TRC20Transfer(token, new Recipient(destination, amount));

    return tron.transactions().factory().create(sender, intent, null);
}
```

Preparation simulates the token call and estimates the native resource cost. The sender needs TRX or available resources to cover execution. A token amount does not pay for energy or bandwidth.

The intent's `feeLimit` caps the combined estimated network fee. The transaction's protocol `fee_limit` field controls the contract execution budget; these values have different roles.

## Native fanout

Deploy the repository's [`Fanout.sol`](../../evm/src/main/solidity/Fanout.sol) to the TRON network before creating a batch. The deployment artifact is compiled by `integration-tests/contracts/compile.cjs` and is stored as `Fanout` in `contracts.json`. Signet's TRON node API exposes contract calls, but does not expose a deployment factory, so deploy the creation bytecode with the deployment tool used for the network. Keep the resulting base58 contract address and verify that code is present before using it.

Use the deployed address with the bundled `Fanout` ABI:

```java
public static TronUnsignedTransaction prepareNativeBatch(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        String fanout,
        List<Recipient> recipients
) {
    return tron.transactions().factory().create(
            sender,
            new TronMultiTransfer(fanout, recipients),
            null
    );
}
```

Amounts are in sun. The native total must fit a positive signed 64-bit integer. The contract call handles the recipients in one transaction.

## Token fanout

Create `TRC20MultiTransfer(fanout, token, recipients, feeLimit)` and obtain the required allowance calls:

```java
public static List<Call<Bool>> tokenBatchApprovals(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        TRC20MultiTransfer intent
) {
    return tron.transactions().factory().approvals(sender, intent, null);
}
```

For each returned call, use `factory.create(sender, call)`, sign, submit, and confirm success. An insufficient nonzero allowance can require a zero approval followed by the target approval. Prepare the final batch after those calls have executed:

```java
public static TronUnsignedTransaction prepareTokenBatch(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        TRC20MultiTransfer intent
) {
    return tron.transactions().factory().create(sender, intent, null);
}
```

An attached `ERC3009Authorization` selects the authorization-based Fanout call and causes `approvals(...)` to return no calls. Use this only with a token and Fanout deployment implementing that path. The encoded authorization must match the intended transfer.

## Fanout with authorization

Use this only for a token that implements ERC3009 and a Fanout deployment that
accepts `receiveWithAuthorization`. Supply the exact token domain: its
`verifyingContract` uses the token's 20-byte EVM address, while the transfer intent
uses TRON Base58 addresses. `validBeforeSeconds` is a future Unix timestamp in seconds.

The default TRON signer returns `RawSignature` for this typed data. Convert its
recoverable ECDSA signature into the ABI signature expected by ERC3009:

```java
public static ERC3009Authorization signReceiveAuthorization(
        TronProvider tron,
        Account<Secp256k1PointOps> owner,
        EIP712Domain tokenDomain,
        String fanoutAddress,
        BigInteger total,
        BigInteger validBeforeSeconds
) {
    var nonceBytes = new byte[32];
    new SecureRandom().nextBytes(nonceBytes);

    var ownerAddress = tron.accounts().address().getPublicAddress(owner);
    var authorization = new ERC3009ReceiveAuthorization(
            tokenDomain,
            TronAddresses.toEvmAddress(ownerAddress),
            TronAddresses.toEvmAddress(fanoutAddress),
            total,
            BigInteger.ZERO,
            validBeforeSeconds,
            "0x" + HexFormat.of().formatHex(nonceBytes)
    );
    var raw = (RawSignature) tron.signer().sign(owner, authorization);
    var signature = (Secp256k1ECDSASignature) raw.signature();
    var recovery = (RecoverableSignature) signature;
    var encoded = new EvmSignature(
            signature.r().toJavaInt(),
            signature.s().toJavaInt(),
            Byte.toUnsignedInt(recovery.recId())
    );

    return new ERC3009Authorization(authorization.call(encoded).data());
}
```

Attach it to the batch. This method uses `signReceiveAuthorization` defined above
on this page, and returns a prepared transaction for the owner to inspect and sign:

```java
public static TronUnsignedTransaction prepareAuthorizedBatch(
        TronProvider tron,
        Account<Secp256k1PointOps> owner,
        EIP712Domain tokenDomain,
        String tokenAddress,
        String fanoutAddress,
        List<Recipient> recipients,
        BigInteger validBeforeSeconds
) {
    var total = recipients.stream()
            .map(Recipient::amount)
            .reduce(BigInteger.ZERO, BigInteger::add);
    var authorization = signReceiveAuthorization(
            tron,
            owner,
            tokenDomain,
            fanoutAddress,
            total,
            validBeforeSeconds
    );
    var intent = new TRC20MultiTransfer(
            fanoutAddress,
            tokenAddress,
            recipients
    ).withAuthorization(authorization);

    return tron.transactions().factory().create(owner, intent, null);
}
```

The owner must submit the outer Fanout transaction because the contract checks
`msg.sender`. No allowance transaction is needed on this path. Keep the signed
authorization and transaction for reconciliation instead of generating another
nonce after an uncertain submission. A failed authorization does not fall back
to allowances.

## Sign and submit

```java
public static Receipt submit(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        TronUnsignedTransaction unsigned
) {
    var signed = (TronSignedTransaction) tron.signer().sign(sender, unsigned);

    return tron.transactions().broadcaster().broadcast(signed);
}
```

Transactions contain node-provided reference-block data and an expiration timestamp. Prepare a fresh transaction when that data expires, after checking whether the previous transaction was accepted. Keep the signed dump and ID for reconciliation.

Actual costs depend on account resources and execution. The returned submission fee is the estimate attached to the prepared transaction. Confirm execution through the node or indexed result.

Executable scenarios: [TronPaymentsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/tron/TronPaymentsTest.java) and the [TRON functional suites](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/tron).
