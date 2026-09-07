# EVM Blocks, Receipts, and History

[Connection](README.md) · [Examples index](../examples/README.md)

**On this page:**

- [Inspect a submitted transaction](#inspect-a-submitted-transaction)
- [Blocks](#blocks)
- [Transaction history](#transaction-history)
- [Logs and historical calls](#logs-and-historical-calls)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.evm.EvmProvider;
import org.exploit.signet.evm.contract.EvmContracts;
import org.exploit.signet.evm.contract.standard.ERC20;
import org.exploit.signet.evm.model.rpc.BlockParameter;
import org.exploit.signet.evm.model.rpc.LogFilter;
import org.exploit.signet.evm.util.EvmHex;
import org.web3j.abi.datatypes.Address;

import java.math.BigInteger;
```

</details>

## Inspect a submitted transaction

```java
public static void inspect(
        EvmProvider evm,
        String txid,
        String address,
        long afterMs
) {
    var receipt = evm.client().receipt(txid);
    if (receipt == null)
        return;

    var fee = receipt.getGasUsed().multiply(EvmHex.quantity(receipt.getEffectiveGasPrice()));
    var block = evm.blocks().api().getBlock(receipt.getBlockNumber().longValueExact());
    var history = evm.transactions().api().getTransactions(address, afterMs);

    System.out.println(receipt.getStatus());
    System.out.println(fee);
    System.out.println(block.hash());
    System.out.println(history);
}
```

`receipt(txid)` can return `null` before inclusion. A mined receipt's `status` is `0x1` for success and `0x0` for revert. Compute the charged network fee from `gasUsed` and `effectiveGasPrice`.

The example reads once. Your application schedules further reads and decides how many confirmations or which finality state it requires.

## Blocks

- `blocks().api().getLatestBlockHeight()` and `getLatestBlock()` use `FINALIZED`.
- `blocks().api().getBlock(height)` returns height, hash, Unix-millisecond timestamp, and successfully executed transactions.
- Failed transactions remain visible through raw RPC blocks and receipts.
- Block mapping obtains receipts through `eth_getBlockReceipts`, falling back to individual receipt requests when that method is unavailable.

For other chain positions, use `evm.client().block(BlockParameter.LATEST)`, `block(BlockParameter.SAFE)`, or an explicit block number. The endpoint must support the requested tag.

## Transaction history

`transactions().api()` uses the configured `EvmTransactionApi`. With Blockbook, it provides lookup by ID, block pagination, and address history. Its successful-history views can omit reverted transactions. Query RPC receipts when tracking submission failures.

Native transaction value and token movement are distinct fields. An ERC20 transfer usually has native `value=0`. Use receipt logs and token balances when reconciling token payments.

## Logs and historical calls

Use `evm.client().logs(LogFilter)` with a block hash or bounded block range, token address, and event topics. `ethCall(call, BlockParameter.number(height))` reads contract state at an explicit height, subject to the node's retained state.

For example, read logs emitted by a contract over a bounded range:

```java
public static void inspectLogs(
        EvmProvider evm,
        String contractAddress,
        long fromHeight,
        long toHeight
) {
    var filter = new LogFilter(
            BlockParameter.number(fromHeight),
            BlockParameter.number(toHeight),
            contractAddress
    );

    for (var log : evm.client().logs(filter)) {
        System.out.println(log);
    }
}
```

To read an ERC20 balance at a specific block:

```java
public static BigInteger historicalTokenBalance(
        EvmProvider evm,
        String tokenAddress,
        String owner,
        long height
) {
    var token = EvmContracts.bind(ERC20.class, tokenAddress);
    var call = token.balanceOf(new Address(owner));

    return evm.client().ethCall(call, BlockParameter.number(height)).getValue();
}
```
