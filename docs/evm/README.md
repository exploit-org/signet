# EVM

Artifacts: `org.exploit.signet:evm` and `org.exploit.signet:blockbook-evm`. ABI bindings and shared intents arrive through `evm-contracts` and `evm-spi`.

- [Transactions and intents](transactions.md)
- [Blocks, receipts, and history](blocks-and-history.md)
- [Contracts, deployment, and permits](contracts.md)
- Examples are embedded in the transaction, contract, and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.exploit.jettyx.Jettyx;
import org.exploit.jettyx.jackson.JacksonHttpMapper;
import org.exploit.signet.evm.EvmProvider;
import org.exploit.signet.evm.blockbook.BlockbookEvmTransactionApi;
import org.exploit.signet.evm.client.EvmRpcApi;
import org.exploit.signet.evm.client.EvmRpcClient;
```

</details>

## Connect

The provider requires an RPC client and an `EvmTransactionApi` for history. The supplied history implementation uses Blockbook. The RPC client uses a Jettyx API proxy:

```java
public static long readTip(
        String rpcUrl,
        String blockbookUrl
) {
    var mapper = new ObjectMapper()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    try (var transport = Jettyx.newBuilder()
            .addHttpMapper(JacksonHttpMapper.create(mapper))
            .build();
         var rpc = new EvmRpcClient(
                 transport.newApiClient(rpcUrl).create(EvmRpcApi.class),
                 mapper
         );
         var history = new BlockbookEvmTransactionApi(blockbookUrl)) {
        var evm = EvmProvider.builder()
                .client(rpc)
                .transactionApi(history)
                .build();

        return evm.blocks().api().getLatestBlockHeight();
    }
}
```

Use endpoints for the same chain. Pin the expected chain ID in application configuration and compare it with `rpc.chainId()` before preparing payments. Each transfer intent carries its chain ID.

The two-argument `EvmRpcClient` constructor leaves transport ownership with the caller, as shown above. The three-argument constructor can take an owned transport for the client to close.

## Accounts and balances

Use `evm.accounts().generator().generate()` or import an account through the [shared account API](../shared/accounts-and-signing.md). `getPublicAddress(account)` returns the EVM address. Pass `null` as the transaction factory's descriptor argument.

`evm.client().balance(address)` reads the native balance. Supply `BlockParameter.PENDING` when pending state is required. Token conversion is available through `SmartUnitConverter`; [token payment examples](transactions.md#send-erc20) show the cast from the provider's `UnitConverter` return type.

## Transaction support

The intent factory creates legacy EIP-155 transactions with `gasPrice`. The parser and block mapper also support access-list, dynamic-fee, blob, and set-code envelopes, types 1 through 4. Preparing and signing through the standard intent factory follows the legacy path.
