# Accounts API

Every provider exposes the same account facade:

```java
Accounts<P> accounts = provider.accounts();

Account<P> account = accounts.generator().generate();
String address = accounts.address().getPublicAddress(account);
BigInteger nativeBalance = accounts.balance().balanceOf(address);
boolean valid = accounts.address().isValidPublicAddress(address);
```

The facade has four services:

| Service | API | Purpose |
| --- | --- | --- |
| `generator()` | `generate()` | Create an in-memory account with a new private key. |
| `factory()` | `create(KeyProvider<P>)` | Wrap an existing or external key provider in a chain account. |
| `address()` | `getPublicAddress(...)`, `isValidPublicAddress(...)` | Derive and validate public addresses. |
| `balance()` | `balanceOf(publicAddress)` | Read the native balance in atomic units. |

`Accounts<P>` is available as `provider.accounts()`. The concrete return type adds chain-specific balance methods where the protocol supports them. Account creation and address derivation do not call the network. Balance methods do.

**On this page:**

- [Account lifecycle](#account-lifecycle)
- [Import an existing key](#import-an-existing-key)
- [Addresses and descriptors](#addresses-and-descriptors)
- [Balances through `accounts()`](#balances-through-accounts)
- [Signing](#signing)
- [External signing](#external-signing)
- [Resource ownership](#resource-ownership)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.ecc.secp256k1.key.Secp256k1PrivateKey;
import org.exploit.signet.bitcoin.constant.BitcoinAddressType;
import org.exploit.signet.bitcoin.constant.BitcoinNetwork;
import org.exploit.signet.bitcoin.model.account.descriptor.BitcoinAccountDescriptor;
import org.exploit.signet.evm.EvmProvider;
import org.exploit.signet.evm.model.transaction.EvmSignedTransaction;
import org.exploit.signet.evm.spi.converter.SmartUnitConverter;
import org.exploit.signet.evm.transaction.signer.EvmSigners;
import org.exploit.signet.secp256k1.ops.InMemorySecp256k1PrivateKey;
import org.exploit.signet.spi.account.Accounts;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.signer.Signer;

import java.math.BigInteger;
```

</details>

## Account lifecycle

`Account<P>` contains the provider environment ID and a `KeyProvider<P>`. It implements `Destroyable`; destroy accounts when their key material is no longer needed. The provider address service checks the account environment before deriving an address.

Load the native libraries before generating or importing in-memory keys. The required calls are documented in [runtime setup](../getting-started/README.md#native-libraries).

Generate an account, derive its address, read its balance, then release it:

```java
var account = evm.accounts().generator().generate();

try {
    var address = evm.accounts().address().getPublicAddress(account);
    var balance = evm.accounts().balance().balanceOf(address);

    System.out.println(address);
    System.out.println(balance);
} finally {
    account.destroy();
}
```

Keep the account alive while it is used for signing. A service that stores only the address cannot later sign a transaction for that address.

## Import an existing key

`factory().create(...)` accepts a `KeyProvider<P>`. The provider keeps the public-key operation and delegates private-key use to that key provider:

```java
var key = Secp256k1PrivateKey.fromBytes(privateKeyBytes);
var account = evm.accounts().factory().create(
        new InMemorySecp256k1PrivateKey(key)
);

try {
    var address = evm.accounts().address().getPublicAddress(account);
    // Use account for transaction preparation and signing.
} finally {
    account.destroy();
}
```

Keep private-key bytes out of logs and clear the caller-owned input after the key provider has consumed them. For HSM, remote, or delegated custody, implement `KeyProvider<P>` and return its public key without exporting the private key.

## Addresses and descriptors

The address service accepts an optional `AccountDescriptor`:

```java
var descriptor = new BitcoinAccountDescriptor(
        BitcoinNetwork.TESTNET,
        BitcoinAddressType.SEGWIT
);
var address = bitcoin.accounts().address().getPublicAddress(account, descriptor);
var valid = bitcoin.accounts().address().isValidPublicAddress(address, descriptor);
```

Use the same descriptor when deriving the address and preparing Bitcoin transactions. The descriptor selects network, address type, and an optional 32-byte Taproot Merkle root. `BitcoinAccountDescriptor.DEFAULT` is mainnet SegWit.

TRON accepts `TronAccountDescriptor`; `null` resolves to the default address byte `0x41`. EVM, Solana, and XRP do not use descriptors, so call the one-argument methods. Passing a descriptor to those address services is rejected or reported as invalid.

TON uses `TonAccountDescriptor` for the network, wallet version, workchain, wallet
ID, and Highload timeout. Use the same descriptor for derivation and preparation;
null defaults to mainnet V5R1. See [TON wallet descriptors](../ton/README.md#wallet-descriptors).

The address formats and key types are:

| Provider | Key type | Address | Descriptor |
| --- | --- | --- | --- |
| Bitcoin | secp256k1 | Legacy, SegWit, or Taproot address selected by `BitcoinAccountDescriptor` | Required for network-specific derivation |
| EVM | secp256k1 | Checksummed `0x` address | None |
| TRON | secp256k1 | Base58Check address, usually `T...` | Optional `TronAccountDescriptor` |
| Solana | Ed25519 | Base58 public key | None |
| TON | Ed25519 | Friendly address or raw `workchain:hash` | `TonAccountDescriptor` selects the wallet contract |
| XRP | secp256k1 or Ed25519 | Classic `r...` address | None |

Use `isValidPublicAddress` at input boundaries. It validates format and, when supplied, the descriptor's network or address byte. It does not prove that the address is funded or exists on the network.

## Balances through `accounts()`

All balances are returned as `BigInteger` atomic units. Convert display values with the provider's converter after reading the balance.

### Native balances

```java
var evmWei = evm.accounts().balance().balanceOf(evmAddress);
var tronSun = tron.accounts().balance().balanceOf(tronAddress);
var solanaLamports = solana.accounts().balance().balanceOf(solanaAddress);
var xrpDrops = xrp.accounts().balance().balanceOf(xrpAddress);
var bitcoinSatoshis = bitcoin.accounts().balance().balanceOf(bitcoinAddress);
```

The backends have different read semantics:

- Bitcoin sums UTXOs returned by the configured explorer.
- EVM reads the native balance from the RPC client.
- TRON reads the account balance from the node.
- Solana reads the lamport balance from the RPC client.
- TON reads the nanoton balance from TONAPI.
- XRP reads the account balance from the current ledger view and returns zero for an unfunded account.

### Token balances

EVM exposes ERC20 balances through its `SmartBalances` implementation:

```java
var tokenUnits = evm.accounts().balance().balanceOf(
        ownerAddress,
        tokenAddress
);
var converter = (SmartUnitConverter) evm.converter();
var displayAmount = converter.toDisplayAmount(tokenAddress, tokenUnits);
```

Solana exposes SPL and Token-2022 balances by owner and mint, plus the matching token accounts:

```java
var tokenUnits = solana.accounts().balance().balanceOf(owner, mint);
var tokenAccounts = solana.accounts().balance().tokenAccounts(owner, mint);
var displayAmount = solana.converter().toDisplayAmount(mint, tokenUnits);
```

Both token conversion directions are shown in [Solana amount conversion by mint](../solana/README.md#amount-conversion-by-mint).

TRON's `TronBalances` also has `balanceOf(publicAddress, contractAddress)` for TRC20:

```java
var tokenUnits = tron.accounts().balance().balanceOf(
        ownerAddress,
        tokenAddress
);
var displayAmount = tron.converter().toDisplayAmount(tokenAddress, tokenUnits);
```

XRP issued-currency balances are not part of `Balances`; query the raw ledger API for trust-line balances. XRP's concrete account service adds a reserve-aware balance:

```java
var spendableDrops = xrp.accounts().balance().spendableBalanceOf(xrpAddress);
```

TON reads a known Jetton through `balanceOf(owner, master)` and exposes indexed
discovery through `jettons(owner, offset, limit)`. The address is the Jetton
master, not the owner's token wallet. See [TON token balances](../ton/contracts.md#jetton-balances-and-discovery)
and [amount conversion](../ton/README.md#amount-conversion).

## Signing

Account management and transaction signing are separate services. Prepare a transaction with `provider.transactions().factory()`, then pass the account and signable value to `provider.signer().sign(...)`:

```java
var unsigned = evm.transactions().factory().create(account, intent, null);
var signed = evm.signer().sign(account, unsigned);
var receipt = evm.transactions().broadcaster().broadcast(
        (EvmSignedTransaction) signed
);
```

The concrete result depends on the signable value:

| Signable | Result |
| --- | --- |
| `BitcoinUnsignedTransaction` | `BitcoinTransaction` |
| `EvmUnsignedTransaction` | `EvmSignedTransaction` |
| EVM permit or authorization | `EvmSignature` |
| `TronUnsignedTransaction` | `TronSignedTransaction` |
| Solana unsigned or partially signed transaction | `SolanaPartiallySignedTransaction` or `SolanaSignedTransaction` |
| `TonUnsignedTransaction` | `TonSignedTransaction` |
| `XrpUnsignedTransaction` | `XrpSignedTransaction` |

The supplied in-memory signer registers these strategies. If an application supplies its own signer, keep the chain-specific strategies registered and preserve these result types.

## External signing

Implement `KeyProvider<P>` for the account's public key and external key reference. Implement `SignerStrategy<ArbitraryData, RawSignature>` for the raw signing operation, then retain the provider's transaction strategies:

```java
Signer signer = EvmSigners.builder(externalEcdsaStrategy).build();

var evm = EvmProvider.builder()
        .client(rpc)
        .transactionApi(history)
        .signer(signer)
        .build();
```

The external strategy receives the account, so it can select the correct key reference from `account.getPrivateKey()`. It must return the Anvil signature type expected by the registered chain strategy. Bitcoin Taproot key-path signing requires the Bitcoin BIP340 strategy in addition to an ECDSA fallback.

## Resource ownership

Close RPC clients, Blockbook adapters, and transports according to the provider setup. Providers do not implement `AutoCloseable`; keep their clients in the application's lifecycle container. Accounts own their key providers and must be destroyed with `account.destroy()`.
