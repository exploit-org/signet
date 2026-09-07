# XRP Ledger

Artifact: `org.exploit.signet:xrp`.

- [Transactions, tags, and batches](transactions.md)
- [Validated ledgers and transaction history](blocks-and-history.md)
- Examples are embedded in the transaction and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.signet.xrp.XrpProvider;
import org.exploit.signet.xrp.client.XrpRpcClient;
```

</details>

## Connect

The provider uses a rippled JSON-RPC client for accounts, preparation, submission, ledgers, and history:

```java
public static long readTip(String rpcUrl) {
    try (var rpc = XrpRpcClient.builder()
            .baseUrl(rpcUrl)
            .build()) {
        var xrp = XrpProvider.builder()
                .client(rpc)
                .build();

        return xrp.blocks().api().getLatestBlockHeight();
    }
}
```

`XrpProvider.builder()` creates a secp256k1 provider. `XrpProvider.ed25519Builder()` creates an Ed25519 provider. Both use `client(rpc).build()`; generate accounts from the selected provider or supply a matching key provider to its account factory.

## Amounts and addresses

Amounts use drops, with six decimals per XRP. Pass a classic account address as the recipient and use the intent's destination tag field when needed. The supplied factory prepares direct XRP payments and atomic XRP payment batches.

It checks the sender's reserve and recipient funding requirements against ledger state. A fee-inclusive payment cannot spend the required sender reserve.

Issued-currency payments, trust lines, offers, escrow, and general smart-contract calls have no high-level intent in this module. Use the raw RPC client for protocol operations exposed by your node and an appropriate implementation for their preparation and signing.
