# Bitcoin

Artifacts: `org.exploit.signet:bitcoin` and `org.exploit.signet:blockbook-bitcoin`.

- [Transactions and intents](transactions.md)
- [Blocks, history, and UTXOs](blocks-and-history.md)
- Examples are embedded in the transaction and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.point.Secp256k1PointOps;
import org.exploit.jettyx.auth.Authorization;
import org.exploit.signet.bitcoin.BitcoinProvider;
import org.exploit.signet.bitcoin.blockbook.BlockbookBitcoinExplorer;
import org.exploit.signet.bitcoin.constant.BitcoinAddressType;
import org.exploit.signet.bitcoin.constant.BitcoinNetwork;
import org.exploit.signet.bitcoin.core.BitcoinCoreClient;
import org.exploit.signet.bitcoin.model.account.descriptor.BitcoinAccountDescriptor;
import org.exploit.signet.spi.model.account.Account;
```

</details>

## Connect

The supplied setup uses Bitcoin Core for fee estimation and Blockbook for full blocks, balances, UTXOs, history, and broadcast. Both endpoints must track the same network.

```java
public static long readTip(
        String coreUrl,
        Authorization auth,
        String blockbookUrl
) {
    try (var core = BitcoinCoreClient.builder()
            .baseUrl(coreUrl)
            .authorization(auth)
            .build();
         var explorer = BlockbookBitcoinExplorer.builder()
                 .baseUrl(blockbookUrl)
                 .build()) {
        var bitcoin = BitcoinProvider.builder()
                .core(core)
                .explorer(explorer)
                .build();

        return bitcoin.blocks().api().getLatestBlockHeight();
    }
}
```

`auth` is a Jettyx `Authorization` configured for Bitcoin Core. Blockbook builders also accept `authorization(...)` when the indexer requires authentication.

For another backend, implement `BitcoinExplorer`. You can supply a custom `BitcoinFeeEstimator` instead of Core, or inject a `BitcoinTransactionFactory` with a different confirmation target and minimum change.

## Address format

Use the same descriptor to derive the deposit address and prepare its spends:

```java
public static String depositAddress(
        BitcoinProvider bitcoin,
        Account<Secp256k1PointOps> account
) {
    var descriptor = new BitcoinAccountDescriptor(
            BitcoinNetwork.REGTEST,
            BitcoinAddressType.SEGWIT
    );

    return bitcoin.accounts().address().getPublicAddress(account, descriptor);
}
```

The example selects regtest. `BitcoinNetwork` contains mainnet, testnet, and regtest settings. `BitcoinAddressType` selects:

- `LEGACY`: P2PKH.
- `SEGWIT`: native P2WPKH.
- `TAPROOT`: P2TR key-path signing.

For a Taproot output committed to a script tree, pass the 32-byte Merkle root as the descriptor's third argument. The default descriptor uses mainnet SegWit; pass a descriptor explicitly in test-network code.

## Supported spending scenarios

The factory spends UTXOs belonging to the selected account and descriptor. It supports a single recipient, several outputs, fee-inclusive budgets, and change back to the source script.

The supplied signer supports P2PKH, P2WPKH, and Taproot key-path inputs.
