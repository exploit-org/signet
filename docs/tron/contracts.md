# TRON Contracts

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.signet.evm.contract.Call;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.tron.TronProvider;
import org.exploit.signet.tron.accounts.address.TronAddresses;
import org.exploit.signet.tron.contract.TronContracts;
import org.exploit.signet.tron.contract.standard.TRC20;
import org.exploit.signet.tron.model.transaction.TronUnsignedTransaction;
import org.web3j.abi.datatypes.Address;

import java.math.BigInteger;
```

</details>

## Read TRC20 state

`TronContracts.bind(...)` accepts a TRON contract address and produces the shared ABI `Call<R>` representation. Convert addresses passed as ABI arguments to their 20-byte EVM form:

```java
public static BigInteger tokenBalance(
        TronProvider tron,
        String tokenAddress,
        String owner
) {
    var token = TronContracts.bind(TRC20.class, tokenAddress);
    var call = token.balanceOf(new Address(TronAddresses.toEvmAddress(owner)));

    return tron.client().simulate(call, owner).result().getValue();
}
```

The caller passed to `simulate` remains a TRON address. Its returned `Simulation<R>` contains the decoded result and energy usage.

Bindings include TRC20, TRC721, TRC721Metadata, and TRC1155. Custom interfaces use the same ABI types and annotations as [EVM contract interfaces](../evm/contracts.md#bind-your-own-abi).

TRON contract interfaces can declare Solidity tuple values with the same `StaticStruct`, `DynamicStruct`, `DynamicArray`, and web3j ABI classes. Follow the [struct declaration example](../evm/contracts.md#declare-abi-structs), then bind the interface with `TronContracts.bind(...)`. Convert TRON addresses to their EVM form when they are used as ABI `Address` fields.

## Submit a contract call

```java
public static TronUnsignedTransaction prepareContractCall(
        TronProvider tron,
        Account<Secp256k1PointOps> sender,
        Call<?> call
) {
    return tron.transactions().factory().create(sender, call);
}
```

For example, bind TRC20 and construct `approve`, `transfer`, or `transferFrom` with web3j `Address` and `Uint256` arguments. Sign and submit the resulting unsigned transaction with the [TRON submission method](transactions.md#sign-and-submit).

Preparation simulates the call, obtains energy requirements, accounts for available resources, and creates the node transaction. Calls returning false are rejected. Check execution and resulting balances after submission.

## Deployment and Fanout

Compile and deploy [`Fanout.sol`](../../evm/src/main/solidity/Fanout.sol) with the target network's TRON deployment tool. The integration fixture produces its creation bytecode as the `Fanout` entry in `integration-tests/src/testFixtures/resources/evm/contracts.json`. Store the resulting base58 address and verify deployed code before passing it to an intent. This module's high-level transaction factory exposes transfers and calls; it has no contract deployment helper.

Native and token batch payments use the bundled Fanout ABI. Confirm that the deployed contract supports the exact methods used by the chosen intent. Allowance management and submission sequencing are shown in [Token fanout](transactions.md#token-fanout).
