# TON

Artifact: `org.exploit.signet:ton`.

- [Transactions, comments, and Highload wallets](transactions.md)
- [Blocks, execution, and transaction history](blocks-and-history.md)
- [Contract calls, getters, and Jettons](contracts.md)
- [Wallet descriptors](#wallet-descriptors)
- [Native and token amounts](#amount-conversion)
- Examples are embedded in the transaction, contract, and block pages below.

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.ton.TonProvider;
import org.exploit.signet.ton.accounts.address.TonAddresses;
import org.exploit.signet.ton.client.TonApiClient;
import org.exploit.signet.ton.constant.TonNetwork;
import org.exploit.signet.ton.constant.TonWalletVersion;
import org.exploit.signet.ton.model.account.descriptor.TonAccountDescriptor;

import java.math.BigDecimal;
```

</details>

## Connect

TONAPI v2 supplies accounts, getters, fee estimation, submission, blocks, and indexed history:

```java
public static long readTip() {
    try (var client = TonApiClient.builder()
            .network(TonNetwork.TESTNET)
            .build()) {
        var ton = new TonProvider(client);

        return ton.blocks().api().getLatestBlockHeight();
    }
}
```

The builder defaults to `MAINNET` at `https://tonapi.io`. `TESTNET` selects
`https://testnet.tonapi.io`. Use `baseUrl(...)` for a private TONAPI instance and
set `network(...)` to match its global ID: `-239` for mainnet or `-3` for testnet.

The builder accepts `authorization(...)` and `jettyx(...)` for authentication and
an existing transport. Closing the client closes only a transport it created.
Keep the client alive for the provider's entire lifetime.

TONAPI is the only built-in backend. Implement `TonClient` for another service.
A provider with a custom client also needs explicit `blocks(...)` and
`transactionApi(...)` services; indexed Jetton discovery and metadata conversion
use `TonApiClient`.

## Wallet descriptors

TON accounts use Ed25519 keys. Load the [native libraries](../getting-started/README.md#native-libraries)
before generating keys or signing. A wallet address depends on the public key and
the wallet contract selected by `TonAccountDescriptor`.

| Version | Replay state | Default wallet ID |
| --- | --- | --- |
| `V3R1`, `V3R2`, `V4R2` | Wallet seqno | `698983191 + workchain` |
| `V5R1` | Wallet seqno | Derived from network, workchain, and subwallet number zero |
| `HIGHLOAD_V3` | Query ID and creation time | `0x10ad` |

The two-argument constructor selects workchain `0`. The full constructor accepts
`network`, `version`, `workchain`, `walletId`, and `timeout`. Supported wallet
workchains are `0` and `-1`. `timeout` is in seconds and belongs only to Highload V3;
its default is 300. Use zero for the other versions.

```java
public static String walletAddress(
        TonProvider ton,
        Account<Ed25519PointOps> account
) {
    var descriptor = new TonAccountDescriptor(
            TonNetwork.TESTNET,
            TonWalletVersion.V5R1
    );

    return ton.accounts().address().getPublicAddress(account, descriptor);
}
```

Use the same descriptor for address derivation and transaction preparation.
`null` resolves to `TonAccountDescriptor.DEFAULT`: mainnet V5R1, workchain `0`.
The client network does not change that default. A different wallet version or
wallet ID can produce a different address for the same key. Highload's timeout
also participates in address derivation.

## Address representation

Generated addresses are non-bounceable, URL-safe friendly addresses. Transfers
accept friendly addresses and raw `workchain:hash` addresses. Bounceable and
test-only flags change the friendly representation, not the underlying account.

```java
public static String bounceableTestnetAddress(String address) {
    return TonAddresses.format(address, true, TonNetwork.TESTNET);
}
```

`isValidPublicAddress(address, descriptor)` checks the address format, workchain,
and test-only flag. It does not identify the deployed wallet version. Preparation
checks the deployed code, public key, wallet ID, and version-specific state.
Test-only transfer destinations are rejected with a mainnet descriptor.

## Amount conversion

Native amounts use nanotons, with nine decimals. Jetton amounts use the token's
metadata decimals. Pass the **Jetton master address** to the token overloads:

| Method | Conversion | Decimals |
| --- | --- | --- |
| `toAtomicAmount(amount)` | TON to nanotons | 9, without network access |
| `toDisplayAmount(amount)` | Nanotons to TON | 9, without network access |
| `toAtomicAmount(master, amount)` | Display token amount to atomic units | TONAPI metadata |
| `toDisplayAmount(master, amount)` | Atomic token units to a display amount | TONAPI metadata |

```java
public static BigDecimal tokenBalance(
        TonProvider ton,
        String owner,
        String master
) {
    var atomic = ton.accounts().balance().balanceOf(owner, master);

    return ton.converter().toDisplayAmount(master, atomic);
}
```

For a token with six decimals, `new BigDecimal("12.50")` converts to `12_500_000`
atomic units. Conversion is exact and rejects excess fractional precision.
Metadata comes from the issuer; conversion does not establish token authenticity
or deduct fees. Keep the concrete converter type (`var` or `TonUnitConverter`)
when using the master-address overloads.

See [Jetton balances and discovery](contracts.md#jetton-balances-and-discovery)
for owner-wallet resolution and indexed token lists.
