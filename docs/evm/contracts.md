# EVM Contracts

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Read a contract](#read-a-contract)
- [Change contract state](#change-contract-state)
- [Bind your own ABI](#bind-your-own-abi)
- [Declare ABI structs](#declare-abi-structs)
- [Deploy a contract](#deploy-a-contract)
- [Permits and authorizations](#permits-and-authorizations)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.signet.evm.EvmProvider;
import org.exploit.signet.evm.contract.Call;
import org.exploit.signet.evm.contract.EvmContracts;
import org.exploit.signet.evm.contract.annotation.FunctionName;
import org.exploit.signet.evm.contract.standard.ERC20;
import org.exploit.signet.evm.contract.standard.ERC2612;
import org.exploit.signet.evm.model.rpc.BlockParameter;
import org.exploit.signet.evm.model.rpc.HexData;
import org.exploit.signet.evm.model.rpc.TransactionRequest;
import org.exploit.signet.evm.model.signature.EIP712Domain;
import org.exploit.signet.evm.model.signature.ERC2612Permit;
import org.exploit.signet.evm.model.transaction.EvmSignature;
import org.exploit.signet.evm.model.transaction.EvmUnsignedTransaction;
import org.exploit.signet.spi.model.account.Account;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.StaticStruct;
import org.web3j.abi.datatypes.generated.Uint160;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint48;

import java.math.BigInteger;
```

</details>

## Read a contract

`EvmContracts.bind(interfaceClass, address)` produces a typed proxy. Calling a proxy method builds `Call<R>`, which carries the destination, ABI data, native value, and result decoder. Execute it through the RPC client:

```java
public static BigInteger tokenBalance(
        EvmProvider evm,
        String tokenAddress,
        String owner
) {
    var token = EvmContracts.bind(ERC20.class, tokenAddress);

    return evm.client().ethCall(token.balanceOf(new Address(owner))).getValue();
}
```

Bindings include ERC20, ERC2612/ERC20Permit, ERC3009, ERC165, ERC721 and its metadata/enumerable extensions, ERC1155 and its metadata extension, WETH9, and Fanout.

## Change contract state

Create an unsigned transaction from a call and chain ID:

```java
public static EvmUnsignedTransaction prepareApproval(
        EvmProvider evm,
        Account<Secp256k1PointOps> owner,
        String tokenAddress,
        String spender,
        BigInteger amount,
        BigInteger chainId
) {
    var token = EvmContracts.bind(ERC20.class, tokenAddress);
    var call = token.approve(new Address(spender), new Uint256(amount));

    return evm.transactions().factory().create(owner, call, chainId);
}
```

Sign and submit with the [transaction submission method](transactions.md#sign-and-submit). Confirm execution before relying on the allowance. To revoke an allowance, pass zero; `transferFrom` calls are sent by the spender account.

For ERC20 methods marked `@OptionalReturn`, empty return data is accepted only when the target has deployed code. A false result fails preparation. Simulation describes the state observed during preparation; inspect the mined result and balances after submission.

## Bind your own ABI

Declare an interface using concrete web3j ABI types:

```java
public interface Counter {
    Call<Uint256> value();

    @FunctionName("set")
    Call<Void> setValue(Uint256 value);
}
```

`@FunctionName` overrides the Java method's ABI name. A parameter annotated `@Value` sets the native call value. Return `Call<Void>` for a function with no output, or a typed `Call<R>` for an ABI return value. Use `EvmContracts.bind(Counter.class, address)` to bind the example interface.

## Declare ABI structs

Declare Solidity `tuple` values as web3j `StaticStruct` or `DynamicStruct` classes. Fields are `public final`, their order matches the ABI tuple, and the constructor passes the same values to `super(...)`:

```java
public static final class PermitDetails extends StaticStruct {
    public final Address token;
    public final Uint160 amount;
    public final Uint48 expiration;
    public final Uint48 nonce;

    public PermitDetails(
            Address token,
            Uint160 amount,
            Uint48 expiration,
            Uint48 nonce
    ) {
        super(token, amount, expiration, nonce);

        this.token = token;
        this.amount = amount;
        this.expiration = expiration;
        this.nonce = nonce;
    }
}

public static final class PermitSingle extends StaticStruct {
    public final PermitDetails details;
    public final Address spender;
    public final Uint256 deadline;

    public PermitSingle(
            PermitDetails details,
            Address spender,
            Uint256 deadline
    ) {
        super(details, spender, deadline);

        this.details = details;
        this.spender = spender;
        this.deadline = deadline;
    }
}

public interface PermitContract {
    Call<Void> permit(
            Address owner,
            PermitSingle permit,
            DynamicBytes signature
    );

    Call<PermitSingle> permitData(Address owner);
}
```

Bind and use the structure like any other ABI argument:

```java
var contract = EvmContracts.bind(PermitContract.class, tokenAddress);
var details = new PermitDetails(
        new Address(tokenAddress),
        new Uint160(amount),
        new Uint48(expiration),
        new Uint48(nonce)
);
var permit = new PermitSingle(
        details,
        new Address(spender),
        new Uint256(deadline)
);

var call = contract.permit(
        new Address(owner),
        permit,
        new DynamicBytes(signature)
);
```

Use `DynamicStruct` when a tuple contains a dynamic member such as `DynamicBytes`, `Utf8String`, a dynamic array, or another dynamic tuple. A dynamic array of structs is declared as `DynamicArray<Order>`, and a fixed array uses a generated type such as `StaticArray4<Bytes32>`. Nested structs and struct return values are decoded through the same `Call<R>` type.

## Deploy a contract

Pass `initCode` as `0x`-prefixed creation bytecode with ABI-encoded constructor arguments already appended:

```java
public static EvmUnsignedTransaction prepareDeployment(
        EvmProvider evm,
        Account<Secp256k1PointOps> sender,
        String initCode,
        BigInteger chainId
) {
    var from = evm.accounts().address().getPublicAddress(sender);
    var rpc = evm.client();
    var request = TransactionRequest.createContractTransaction(
            from,
            null,
            null,
            null,
            BigInteger.ZERO,
            initCode
    );

    return new EvmUnsignedTransaction(
            rpc.transactionCount(from, BlockParameter.PENDING),
            rpc.gasPrice(),
            rpc.estimateGas(request),
            null,
            BigInteger.ZERO,
            new HexData(initCode),
            chainId,
            System.currentTimeMillis()
    );
}
```

This lower-level example estimates gas and supplies a pending nonce. The caller checks the native balance and fee budget before signing. After successful inclusion, read `receipt.getContractAddress()` and verify deployed code through `client().code(address)`.

## Permits and authorizations

The EVM signer supports `ERC2612Permit`, `ERC3009TransferAuthorization`, `ERC3009ReceiveAuthorization`, and `ERC3009CancelAuthorization`.

For ERC2612, obtain the owner's current token nonce and sign an authorization using the exact contract domain:

```java
public static Call<Void> signPermit(
        EvmProvider evm,
        Account<Secp256k1PointOps> owner,
        EIP712Domain domain,
        String spender,
        BigInteger amount,
        BigInteger deadlineSeconds
) {
    var ownerAddress = evm.accounts().address().getPublicAddress(owner);
    var token = EvmContracts.bind(ERC2612.class, domain.verifyingContract());
    var nonce = evm.client().ethCall(token.nonces(new Address(ownerAddress))).getValue();
    var permit = new ERC2612Permit(domain, ownerAddress, spender, amount, nonce, deadlineSeconds);

    var signature = (EvmSignature) evm.signer().sign(owner, permit);

    return permit.call(signature);
}
```

The caller supplies `EIP712Domain(name, version, chainId, verifyingContract)` using that token's domain values. `deadlineSeconds` is a Unix timestamp in seconds. A relayer can prepare the returned call using its own account, pay the gas, and submit the permit.

For ERC3009, use a unique 32-byte authorization nonce and explicit validity
timestamps in Unix seconds. The full inline [relayer example](transactions.md#direct-transferwithauthorization)
shows nonce generation, owner signing, transaction preparation, and relayer submission.

`ERC3009TransferAuthorization.call(signature)` produces the direct token call. For Fanout, use `ERC3009ReceiveAuthorization.call(signature).data()`, wrap it in `ERC3009Authorization`, and attach it to `ERC20MultiTransfer.withAuthorization(...)`. The complete Fanout flow, including the deployment prerequisite, is in [EVM transaction scenarios](transactions.md#native-fanout).

The repository's executable scenario is [EvmFanoutAuthorizationTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/evm/EvmFanoutAuthorizationTest.java). It deploys `FiatTokenV2_2` and `Fanout`, signs a receive authorization, confirms that no approval is requested, checks recipient balances, then verifies replay and tampering rejection. The same contract path is covered for TRON in [TronFanoutAuthorizationTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/tron/TronFanoutAuthorizationTest.java).

Executable scenarios: [EvmTokensTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/evm/EvmTokensTest.java) and the other [EVM functional suites](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/evm).
