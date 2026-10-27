# Stellar / XLM

Artifact: `org.exploit.signet:xlm`.

- [Payments, account creation and envelope parsing](transactions.md)
- [Ledgers, submission and confirmed results](blocks-and-history.md)

## Connect

```java
import org.exploit.signet.xlm.XlmProvider;
import org.exploit.signet.xlm.client.XlmRpcClient;
import org.exploit.signet.xlm.constant.XlmNetworks;

public static long readTip(String rpcUrl) {
    try (var rpc = XlmRpcClient.builder()
            .baseUrl(rpcUrl)
            .network(XlmNetworks.MAINNET)
            .build()) {
        return XlmProvider.builder().client(rpc).build()
                .blocks().api().getLatestBlockHeight();
    }
}
```

Preparation and submission fail if the RPC endpoint reports a different network
passphrase. Use `XlmNetworks.TESTNET` for Testnet or construct `XlmNetwork` with
a private network's passphrase.

## Accounts and amounts

Accounts use Ed25519 keys. Load the [native libraries](../getting-started/README.md#native-libraries)
before generating keys or signing. Amounts use integer stroops: 1 XLM is 10,000,000
stroops. The unit converter rejects amounts that cannot be represented in whole stroops.

`balanceOf(address)` returns the total XLM balance. `spendableBalanceOf(address)`
subtracts the required reserve and selling liabilities. Sponsorship adjusts the
reserve: sponsoring other accounts or entries increases it; receiving sponsorship
reduces it. The transaction fee must also fit within the remaining balance.

Both `G...` and `M...` payment addresses are accepted. A muxed address shares the
underlying G account's balance, sequence and authorization. Preserve its ID when
preparing a payment so the recipient can route it correctly.

The transaction factory prepares native XLM payments, account creation and payment
batches. The parser supports Classic and Soroban operations in Protocol 29 envelopes.
Issued-asset and Soroban transactions must be prepared separately before parsing
and signing.
