# TRON

Artifacts: `org.exploit.signet:tron` and `org.exploit.signet:blockbook-tron`.

- [Transactions and intents](transactions.md)
- [Blocks and history](blocks-and-history.md)
- [Contracts](contracts.md)
- Examples are embedded in the transaction, contract, and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.tron.TronProvider;
import org.exploit.signet.tron.blockbook.BlockbookTronTransactionApi;
import org.exploit.signet.tron.client.TronClient;
```

</details>

## Connect

The provider combines a TRON node HTTP client with a `TronTransactionApi`. The supplied history adapter uses Blockbook:

```java
public static long readTip(
        String nodeUrl,
        String blockbookUrl
) {
    try (var client = TronClient.builder()
            .baseUrl(nodeUrl)
            .build();
         var history = BlockbookTronTransactionApi.builder()
                 .baseUrl(blockbookUrl)
                 .build()) {
        var tron = TronProvider.builder()
                .client(client)
                .transactionApi(history)
                .build();

        return tron.blocks().api().getLatestBlockHeight();
    }
}
```

Point the node and indexer at the same network. Both builders support `authorization(...)` and an externally managed Jettyx transport.

## Accounts and amounts

TRON uses secp256k1 accounts. Generate or import keys through the [shared account API](../shared/accounts-and-signing.md). `tron.accounts().address().getPublicAddress(account)` returns a Base58Check address.

The default `TronAccountDescriptor` uses address byte `0x41`. Network selection comes from the node endpoint. Native amounts use sun, with six decimals per TRX. `tron.converter()` also supports token-specific conversion by contract address.

The provider offers native and token payments, Fanout calls, typed contract simulation, transaction parsing, confirmed block reads, and indexed history.
