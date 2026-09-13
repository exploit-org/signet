# EVM Transactions

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Intents](#intents)
- [Send the native asset](#send-the-native-asset)
- [Send ERC20](#send-erc20)
- [Native fanout](#native-fanout)
- [ERC20 fanout and allowances](#erc20-fanout-and-allowances)
- [Direct `transferWithAuthorization`](#direct-transferwithauthorization)
- [Fanout with authorization](#fanout-with-authorization)
- [Sign and submit](#sign-and-submit)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.signet.evm.EvmProvider;
import org.exploit.signet.evm.contract.Call;
import org.exploit.signet.evm.model.signature.EIP712Domain;
import org.exploit.signet.evm.model.signature.ERC3009ReceiveAuthorization;
import org.exploit.signet.evm.model.signature.ERC3009TransferAuthorization;
import org.exploit.signet.evm.model.transaction.signature.EvmSignature;
import org.exploit.signet.evm.model.transaction.EvmSignedTransaction;
import org.exploit.signet.evm.model.transaction.EvmUnsignedTransaction;
import org.exploit.signet.evm.spi.converter.SmartUnitConverter;
import org.exploit.signet.evm.spi.intent.ERC20MultiTransfer;
import org.exploit.signet.evm.spi.intent.ERC20Transfer;
import org.exploit.signet.evm.spi.intent.EvmMultiTransfer;
import org.exploit.signet.evm.spi.intent.EvmTransfer;
import org.exploit.signet.evm.spi.signature.ERC3009Authorization;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.network.Receipt;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
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
| `EvmTransfer` | recipient, chain ID | `withFee`, fee limit |
| `ERC20Transfer` | token contract, recipient, chain ID | fee limit |
| `EvmMultiTransfer` | Fanout contract, recipients, chain ID | fee limit |
| `ERC20MultiTransfer` | Fanout contract, token contract, recipients, chain ID | fee limit, ERC3009 authorization |

Native values and fee limits use wei. Token values use the token's atomic units. `withFee` defaults to false for a native transfer.

## Send the native asset

```java
public static EvmUnsignedTransaction preparePayment(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        String destination,
        BigInteger chainId
) {
    var amount = evm.converter().toAtomicAmount(new BigDecimal("0.01"));
    var feeLimit = evm.converter().toAtomicAmount(new BigDecimal("0.001"));

    var intent = new EvmTransfer(new Recipient(destination, amount), false, chainId, feeLimit);

    return evm.transactions().factory().create(sender, intent, null);
}
```

Preparation reads the pending nonce and balance, estimates gas, and obtains the gas price. `unsigned.fee()` is `gasLimit * gasPrice`.

For a fee-inclusive native budget, construct `EvmTransfer(recipient, true, chainId, feeLimit)`. The destination receives the requested amount minus the estimated fee. Unused gas can leave a remainder with the sender.

Serialize submissions from the same account. Two concurrent preparations can observe the same pending nonce.

## Send ERC20

```java
public static EvmUnsignedTransaction prepareTokenPayment(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        String tokenAddress,
        String destination,
        BigInteger chainId
) {
    var converter = (SmartUnitConverter) evm.converter();
    var amount = converter.toAtomicAmount(tokenAddress, new BigDecimal("12.50"));
    var intent = new ERC20Transfer(tokenAddress, new Recipient(destination, amount), chainId);

    return evm.transactions().factory().create(sender, intent, null);
}
```

The factory creates a contract call with zero native value. The sender still needs native funds for gas. Preparation simulates the call; a decoded false result or invalid response prevents submission through this path.

## Native fanout

The repository includes the Solidity implementation at [`evm/src/main/solidity/Fanout.sol`](../../evm/src/main/solidity/Fanout.sol). Compile and deploy that source, or deploy a compatible contract with the same ABI and safety checks. The source validates batch length, recipient addresses, nonzero amounts, native `msg.value`, token inbound amount, and final token balance. It reverts the whole call when one recipient transfer fails.

The test contract artifact is produced by `integration-tests/contracts/compile.cjs` as `Fanout` in `contracts.json`. In an application, keep the compiler version and deployment artifact pinned, then prepare its creation transaction using the inline [deployment example](contracts.md#deploy-a-contract), sign it, and broadcast it. Check the resulting transaction ID with:

```java
public static String deployedContract(
        EvmProvider evm,
        String deploymentTxid
) {
    var receipt = evm.client().receipt(deploymentTxid);
    if (receipt == null)
        return null;

    if (!"0x1".equals(receipt.getStatus()))
        throw new IllegalStateException("Contract deployment failed");

    var address = receipt.getContractAddress();
    var code = evm.client().code(address);
    if (code == null || code.equals("0x"))
        throw new IllegalStateException("Deployed contract has no code");

    return address;
}
```

`deployedContract` returns `null` while the receipt is unavailable. Call it again from your application's scheduled confirmation check; store the address after successful execution and your required confirmation depth. Supply creation bytecode explicitly as shown on the deployment page.

After deployment, prepare a single call:

```java
public static EvmUnsignedTransaction prepareNativeBatch(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        String fanout,
        List<Recipient> recipients,
        BigInteger chainId
) {
    return evm.transactions().factory().create(
            sender,
            new EvmMultiTransfer(fanout, recipients, chainId),
            null
    );
}
```

`recipients` contains native atomic amounts. The contract address must contain deployed code. Signet supplies the ABI binding and preparation logic; your deployment supplies the contract address.

## ERC20 fanout and allowances

Create `ERC20MultiTransfer(fanout, token, recipients, chainId, feeLimit)`. Ask the factory which approval calls are required:

```java
public static List<Call<Bool>> tokenBatchApprovals(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        ERC20MultiTransfer intent
) {
    return evm.transactions().factory().approvals(sender, intent);
}
```

The returned list can contain zero, one, or two calls. An insufficient nonzero allowance produces an approval to zero followed by an approval to the required total.

For each call, use `factory.create(sender, call, chainId)`, sign, submit, and verify a successful receipt before processing the next call. After approvals are effective, prepare the batch:

```java
public static EvmUnsignedTransaction prepareTokenBatch(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        ERC20MultiTransfer intent
) {
    return evm.transactions().factory().create(sender, intent, null);
}
```

The factory does not broadcast approvals. Their gas fees are additional to the batch's fee limit.

For a token supporting ERC3009, `withAuthorization(...)` attaches an `ERC3009Authorization` containing encoded `receiveWithAuthorization` calldata. The authorization must match the token, sender, Fanout destination, total, and validity window. With that field set, `approvals(...)` returns an empty list. See [typed authorizations](contracts.md#permits-and-authorizations).

## Direct `transferWithAuthorization`

For a token exposing ERC-3009's direct `transferWithAuthorization`, the owner signs the typed authorization and a relayer can pay gas:

```java
public static Receipt transferWithAuthorization(
        EvmProvider evm,
        Account<Secp256k1PointOps> owner,
        Account<Secp256k1PointOps> relayer,
        EIP712Domain tokenDomain,
        String recipient,
        BigInteger amount,
        BigInteger validBeforeSeconds
) {
    var nonceBytes = new byte[32];
    new SecureRandom().nextBytes(nonceBytes);

    var from = evm.accounts().address().getPublicAddress(owner);
    var authorization = new ERC3009TransferAuthorization(
            tokenDomain,
            from,
            recipient,
            amount,
            BigInteger.ZERO,
            validBeforeSeconds,
            "0x" + HexFormat.of().formatHex(nonceBytes)
    );
    var signature = (EvmSignature) evm.signer().sign(owner, authorization);
    var unsigned = evm.transactions().factory().create(
            relayer,
            authorization.call(signature),
            tokenDomain.chainId()
    );
    var signed = (EvmSignedTransaction) evm.signer().sign(relayer, unsigned);

    return evm.transactions().broadcaster().broadcast(signed);
}
```

`tokenDomain.verifyingContract()` must be the token address. The authorization binds `from`, `to`, amount, validity window, and a unique 32-byte nonce. Query the token's authorization state or balances after confirmation. A failed or expired authorization does not become an allowance fallback.

## Fanout with authorization

Use `receiveWithAuthorization` for a previously deployed Fanout contract:

```java
public static EvmUnsignedTransaction prepareAuthorizedBatch(
        EvmProvider evm,
        Account<Secp256k1PointOps> owner,
        EIP712Domain tokenDomain,
        String fanoutAddress,
        List<Recipient> recipients,
        BigInteger validBeforeSeconds
) {
    var nonceBytes = new byte[32];
    new SecureRandom().nextBytes(nonceBytes);

    var from = evm.accounts().address().getPublicAddress(owner);
    var total = recipients.stream()
            .map(Recipient::amount)
            .reduce(BigInteger.ZERO, BigInteger::add);
    var authorization = new ERC3009ReceiveAuthorization(
            tokenDomain,
            from,
            fanoutAddress,
            total,
            BigInteger.ZERO,
            validBeforeSeconds,
            "0x" + HexFormat.of().formatHex(nonceBytes)
    );
    var signature = (EvmSignature) evm.signer().sign(owner, authorization);
    var intent = new ERC20MultiTransfer(
            fanoutAddress,
            tokenDomain.verifyingContract(),
            recipients,
            tokenDomain.chainId()
    ).withAuthorization(new ERC3009Authorization(authorization.call(signature).data()));

    return evm.transactions().factory().create(owner, intent, null);
}
```

The Fanout contract requires the authorizer to submit the outer transaction because its authorization binds `from` to `msg.sender`. The owner therefore signs and broadcasts this specific Fanout path. The total authorization amount must equal the sum of all recipients. The method returns an unsigned batch for the owner to sign using the submission example below; no approval transaction is needed. Both authorization examples take `validBeforeSeconds` as a future Unix timestamp in seconds. Persist the signed authorization/transaction when retrying the same operation.

## Sign and submit

```java
public static Receipt submit(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        EvmUnsignedTransaction unsigned
) {
    var signed = (EvmSignedTransaction) evm.signer().sign(sender, unsigned);

    return evm.transactions().broadcaster().broadcast(signed);
}
```

The broadcaster checks the signed chain ID against the RPC endpoint. The returned `Receipt` contains the submitted ID and estimated fee. Check the [execution receipt](blocks-and-history.md) for status and actual gas charges.
