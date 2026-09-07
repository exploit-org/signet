# Dependencies and Runtime

Choose the chain artifacts first, then configure Java and native libraries. The
complete read-only example below uses Bitcoin and Blockbook. It needs a running
Bitcoin Blockbook endpoint and does not need a funded account.

**On this page:**

- [Gradle](#gradle)
- [Snapshots](#snapshots)
- [Maven](#maven)
- [Native libraries](#native-libraries)
- [First read: a complete Bitcoin block](#first-read-a-complete-bitcoin-block)
- [Connect and prepare a payment](#connect-and-prepare-a-payment)

<details>
<summary>Imports for the examples on this page</summary>

```java
import org.exploit.bigint.LibGMP;
import org.exploit.ecc.secp256k1.LibSecp256k1;
import org.exploit.signet.bitcoin.blockbook.BlockbookBitcoinExplorer;
import org.exploit.sodium.LibSodium;

import java.time.Instant;
```

</details>

## Gradle

Use Java 25. Define `signetVersion` in your application's `gradle.properties` using a version available in your chosen repository. For a local build of this checkout, its default version is `1.0-SNAPSHOT`; use `mavenLocal()` after publishing locally.

```groovy
plugins {
    id 'java'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation platform("org.exploit.signet:bom:${signetVersion}")
    implementation 'org.exploit.signet:bitcoin'
    implementation 'org.exploit.signet:blockbook-bitcoin'
}
```

Select the artifacts needed by your application:

- `bitcoin` and `blockbook-bitcoin`: Bitcoin with the supplied explorer adapter.
- `evm` and `blockbook-evm`: EVM RPC and indexed transaction history.
- `tron` and `blockbook-tron`: TRON node API and indexed transaction history.
- `solana`: Solana RPC, accounts, tokens, transactions, and programs.
- `xrp`: XRP Ledger RPC, accounts, payments, and batches.

The chain artifacts bring their shared dependencies transitively. `spi` owns common interfaces, `crypto-util` owns encoding and hash helpers, and the two curve support modules connect Signet to Anvil. `evm-spi` supplies the shared EVM intents and amount interfaces; `evm-contracts` supplies ABI bindings used by EVM and TRON.

Anvil versions are managed through `org.exploit.anvil:bom`. The current build pins Anvil to `0.2.2` in the root build file.

## Snapshots

Add the snapshot repository when consuming a version ending in `-SNAPSHOT`:

```groovy
repositories {
    mavenCentral()
    maven {
        url = uri('https://central.sonatype.com/repository/maven-snapshots/')
        mavenContent {
            snapshotsOnly()
        }
    }
}
```

For a locally built version, use `mavenLocal()` after running `publishAllToMavenLocal`. See [Publishing](../publishing.md) for the build commands. Repository availability depends on which versions have actually been published.

## Maven

Define `signet.version` in your application's properties and import the BOM:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.exploit.signet</groupId>
      <artifactId>bom</artifactId>
      <version>${signet.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
<dependencies>
  <dependency>
    <groupId>org.exploit.signet</groupId>
    <artifactId>solana</artifactId>
  </dependency>
</dependencies>
```

## Native libraries

In-memory keys use Anvil's native libraries. Add the native bundle for the host platform to the runtime classpath. For example, Linux amd64:

```groovy
dependencies {
    runtimeOnly 'org.exploit:tss4j-natives:1.0.0:linux-amd64@jar'
}
```

The repository also uses the `macos-aarch64` and `windows-amd64` classifiers. Configure the JVM to allow native access for `ALL-UNNAMED`. For Gradle application
and test tasks:

```groovy
tasks.withType(JavaExec).configureEach {
    jvmArgs '--enable-native-access=ALL-UNNAMED'
}

tasks.withType(Test).configureEach {
    jvmArgs '--enable-native-access=ALL-UNNAMED'
}
```

For another launcher, add `--enable-native-access=ALL-UNNAMED` to its JVM options.

Initialize the libraries before generating keys or signing. Bitcoin, EVM, TRON, and XRP secp256k1 use:

```java
public static void loadSecp256k1() {
    LibGMP.load();
    LibSecp256k1.load();
}
```

Solana and XRP Ed25519 use:

```java
public static void loadEd25519() {
    LibGMP.load();
    LibSodium.load();
}
```

An application using both curves loads all three libraries once during startup.

## First read: a complete Bitcoin block

This is a complete class. `args[0]` is your Bitcoin Blockbook base URL. It owns and
closes the explorer; the returned block has already been decoded before closing.
No Bitcoin Core connection is needed for this read. Core is used for fee estimation
in the full [Bitcoin provider setup](../bitcoin/README.md#connect).

```java
import org.exploit.signet.bitcoin.blockbook.BlockbookBitcoinExplorer;

import java.time.Instant;

public final class ReadBitcoinBlock {
    public static void main(String[] args) {
        if (args.length != 1)
            throw new IllegalArgumentException("Pass the Bitcoin Blockbook base URL");

        try (var explorer = BlockbookBitcoinExplorer.builder()
                .baseUrl(args[0])
                .build()) {
            var block = explorer.getLatestBlock();

            System.out.println("Height: " + block.height());
            System.out.println("Hash: " + block.hash());
            System.out.println("Time: " + Instant.ofEpochMilli(block.timestampMs()));

            for (var transaction : block.transactions()) {
                System.out.println(transaction.txid());
            }
        }
    }
}
```

See [Bitcoin blocks](../bitcoin/blocks-and-history.md) for the model fields, UTXOs,
history pagination, and migration from the former height-only response.

## Connect and prepare a payment

1. Build a provider using the network's [connection example](../README.md#blockchain-modules).
2. Generate or import an [account](../shared/accounts-and-signing.md).
3. Fund its address on the network used by the configured endpoint.
4. Call a transaction factory with an intent and amounts in atomic units.
5. Inspect the unsigned transaction before calling the signing and submission methods.

For local nodes and funded test scenarios, see [integration test setup](../../integration-tests/README.md). The functional fixtures contain node lifecycle and funding helpers.
