# TON Contracts and Jettons

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Compose a contract call](#compose-a-contract-call)
- [Read a getter](#read-a-getter)
- [Deploy a contract](#deploy-a-contract)
- [Jetton balances and discovery](#jetton-balances-and-discovery)
- [Send Jettons](#send-jettons)
- [Burn Jettons](#burn-jettons)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.spi.converter.DecimalUnitConverter;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
import org.exploit.signet.ton.TonProvider;
import org.exploit.signet.ton.contract.TonCall;
import org.exploit.signet.ton.contract.TonContract;
import org.exploit.signet.ton.contract.standard.TonJetton;
import org.exploit.signet.ton.model.account.descriptor.TonAccountDescriptor;
import org.exploit.signet.ton.model.contract.TonArgument;
import org.exploit.signet.ton.model.transaction.TonUnsignedTransaction;
import org.ton.ton4j.cell.Cell;
import org.ton.ton4j.tlb.StateInit;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
```

</details>

## Compose a contract call

`TonContract` binds an address. `call(...)` returns a `TonCall` accepted by the
transaction factory. The application supplies the contract's message schema:
there is no universal Solidity-style ABI encoder.

This example targets the repository's counter fixture: opcode `1`, a 64-bit
query ID, and a 32-bit increment. Use the schema expected by your contract:

```java
public static TonUnsignedTransaction prepareIncrement(
        TonProvider ton,
        Account<Ed25519PointOps> sender,
        TonAccountDescriptor descriptor,
        String contractAddress,
        long queryId
) {
    var contract = new TonContract(contractAddress);
    var call = contract.call(
            BigInteger.valueOf(100_000_000),
            1,
            queryId,
            body -> body.storeUint(7, 32)
    );

    return ton.transactions().factory().create(sender, call, descriptor);
}
```

The helper writes a 32-bit opcode and a 64-bit query ID before invoking the field
builder. For another layout, build a ton4j `Cell` and use `contract.call(value, body)`.
Wrappers can expose typed Java methods returning `TonCall`, as `TonJetton` does.

Calls default to bounceable delivery. The attached positive value supplies TON
for the destination's execution. Payload and StateInit cells are snapshotted
when constructing the call. Follow [signing and submission](transactions.md#sign-and-submit)
after preparation. Highload senders use the factory overload with a separate
wallet query ID.

## Read a getter

`TonGetMethod<R>` carries the method name, typed arguments, and a result decoder.
Execute it through `client.runGetMethod(...)`; getters do not persist changes:

```java
public static BigInteger readCounter(TonProvider ton, String contractAddress) {
    var contract = new TonContract(contractAddress);
    var getter = contract.get("get_counter", stack -> stack.number(0));

    return ton.client().runGetMethod(getter);
}

public static BigInteger addToCounter(
        TonProvider ton,
        String contractAddress,
        long amount
) {
    var contract = new TonContract(contractAddress);
    var getter = contract.get(
            "add",
            List.of(TonArgument.number(amount)),
            stack -> stack.number(0)
    );

    return ton.client().runGetMethod(getter);
}
```

These getters belong to the same counter fixture. `add` returns a computed value
without updating stored state. Argument helpers support int257 numbers, cells,
slices, and addresses encoded as slices.

Without a decoder, `contract.get(method, arguments...)` returns a `TonStack`.
Its accessors include `number`, `bool`, `cell`, `address`, and nested `tuple`.
`value(index)` exposes the underlying mutable ton4j TVM model. Non-success getter
exit codes raise `TonRpcException` before the decoder runs.

## Deploy a contract

Provide compiled contract code, its initial data, and the initial message body:

```java
public static TonCall deployment(Cell code, Cell data, Cell body) {
    var init = StateInit.builder().code(code).data(data).build();
    var address = init.getAddress(0).toRaw();

    return new TonContract(address).call(
            BigInteger.valueOf(200_000_000),
            body,
            init,
            false,
            null
    );
}
```

Pass the result to the factory with a V3/V4/V5 sender descriptor. The destination
address must match the StateInit hash. This example selects non-bounceable
delivery to initialize a fresh contract; the body must follow that contract's
initialization protocol. The sender wallet's own StateInit is handled separately.

Highload V3 direct calls reject destination StateInit. Its self-message batch
deployment protocol is not exposed by this API.

Sender success does not imply destination success. A contract can reject a
message, charge fees, roll back its storage, and bounce the remaining value.
Inspect the [executed messages and results](blocks-and-history.md#inspect-execution).

## Jetton balances and discovery

`TonJetton` binds the **master address**. Each owner has a separate Jetton wallet;
the wrapper resolves it through `get_wallet_address` and reads `get_wallet_data`:

```java
public static void inspectToken(TonProvider ton, String owner, String master) {
    var jetton = new TonJetton(ton.client(), master);
    var balance = ton.accounts().balance().balanceOf(owner, master);

    System.out.println("Jetton wallet: " + jetton.walletAddress(owner));
    System.out.println("Atomic balance: " + balance);
    System.out.println("Total supply: " + jetton.totalSupply());
}
```

The balance read verifies the returned wallet owner and master. An undeployed
Jetton wallet has zero balance; RPC failures and frozen wallets are not converted
to zero. `jetton.data()` exposes the master getter stack, and
`client.runGetMethod(jetton.wallet(owner).data())` exposes the wallet getter stack.

To discover tokens held by an owner, use the paginated TONAPI index:

```java
public static void listTokens(TonProvider ton, String owner, int offset) {
    var tokens = ton.accounts().balance().jettons(owner, offset, 100);

    for (var token : tokens) {
        var units = new DecimalUnitConverter(token.decimals());
        var balance = units.toDisplayAmount(token.balance());

        System.out.println(token.master() + " " + token.symbol() + " " + balance.toPlainString());
    }
}
```

Offsets start at zero; limits are 1 through 1,000. Items include master address,
owner's Jetton wallet address, atomic balance, decimals, name, and symbol. Indexed
balances can lag execution. Use `balanceOf(owner, master)` for a known token and
verify the master address rather than relying on its display name or symbol.

## Send Jettons

Use a TEP-74 transfer to the recipient's **owner address**, not its Jetton wallet:

```java
public static TonUnsignedTransaction prepareTokenPayment(
        TonProvider ton,
        Account<Ed25519PointOps> sender,
        TonAccountDescriptor descriptor,
        String master,
        String destinationOwner,
        long queryId
) {
    var owner = ton.accounts().address().getPublicAddress(sender, descriptor);
    var jetton = new TonJetton(ton.client(), master);
    var amount = ton.converter().toAtomicAmount(master, new BigDecimal("12.50"));
    var call = jetton.transfer(
            owner,
            new Recipient(destinationOwner, amount),
            BigInteger.valueOf(300_000_000),
            queryId
    );

    return ton.transactions().factory().create(sender, call, descriptor);
}
```

This preparation overload uses a V3/V4/V5 sender. Token amounts use token atomic
units; the attached `0.3 TON` pays for the Jetton message chain. Select the attached
value for the token contract and recipient state. The convenience call forwards
one nanoton for a transfer notification and returns excess TON to the owner.

`jetton.wallet(owner).transfer(recipient, value, queryId, responseDestination,
customPayload, forwardAmount, forwardPayload)` exposes the response destination
and payload options. `forwardAmount` must be nonnegative and less than the attached
TON. Sign with the owner's key and confirm destination delivery and token balance
changes. Use an application wrapper for nonstandard token operations.

## Burn Jettons

```java
public static TonCall burnTokens(
        TonProvider ton,
        String master,
        String owner,
        BigInteger amount,
        long queryId
) {
    return new TonJetton(ton.client(), master).burn(
            owner,
            amount,
            BigInteger.valueOf(300_000_000),
            queryId
    );
}
```

`amount` is a positive atomic token amount. Prepare and sign the returned call
with the owner account, then verify the wallet balance and master's total supply
after the burn notification is processed.

Executable scenarios: [TonContractsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/ton/TonContractsTest.java)
and [TonJettonsTest](../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/ton/TonJettonsTest.java).
