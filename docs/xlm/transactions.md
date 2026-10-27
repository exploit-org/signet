# Stellar transactions

[Connection](README.md) · [Submission and results](blocks-and-history.md)

## Prepare native XLM

```java
import org.exploit.ecc.ed25519.point.Ed25519PointOps;
import org.exploit.signet.spi.model.account.Account;
import org.exploit.signet.spi.model.transaction.recipient.Recipient;
import org.exploit.signet.xlm.XlmProvider;
import org.exploit.signet.xlm.model.intent.XlmTransfer;
import org.exploit.signet.xlm.model.transaction.XlmMemo;
import org.exploit.signet.xlm.model.transaction.XlmUnsignedTransaction;
import java.math.BigInteger;

public static XlmUnsignedTransaction prepare(XlmProvider xlm,
        Account<Ed25519PointOps> sender, String destination) {
    var intent = new XlmTransfer(new Recipient(destination, BigInteger.valueOf(10_000_000)),
            XlmMemo.id(BigInteger.valueOf(1042)), false, BigInteger.valueOf(10_000));
    return xlm.transactions().factory().create(sender, intent);
}
```

`XlmTransfer` requires an existing destination. Use `XlmCreateAccount` with a
G address and starting balance to create an account. `XlmMultiTransfer` accepts
1–100 recipients and one transaction-wide memo. Its operations execute atomically.

`withFee=true` subtracts the transaction fee from the recipient amount. The factory
checks the fee against both the intent's `feeLimit` and the factory's
`XlmTransactionOptions.maxFee`. Defaults are 1,000,000 stroops maximum fee and
300 seconds of validity measured from the reference ledger's close time.

Preparation requires a source whose master key can authorize the generated
operations alone. For multisig accounts, prepare the full envelope separately
and collect its required signatures. Coordinate preparation and submission per
transaction source to avoid competing sequence numbers.

## Parse an envelope

```java
import org.exploit.signet.xlm.constant.XlmNetworks;
import org.exploit.signet.xlm.model.transaction.XlmRawTransaction;
import org.exploit.signet.xlm.transaction.parser.XlmTransactionParser;

public static XlmRawTransaction parse(String base64Envelope) {
    return new XlmTransactionParser(XlmNetworks.MAINNET).parse(base64Envelope);
}
```

The parser accepts TransactionV0, TransactionV1 and FeeBumpTransaction envelopes
as canonical Base64 XDR. It exposes all operations and their parameters, including
Soroban calls and authorization entries. Invalid or unsupported encodings fail
with `XlmTransactionParseException` (`INVALID_TRANSACTION`). The input limit is 1 MiB.

`envelope()` returns the exact envelope structure. `data()` returns its transaction
body; a V0 body is converted to the equivalent V1 signing form. For a fee bump,
`data()` describes the inner transaction, `fee()` and `feeSource()` describe the
outer fee commitment, and `innerTransaction()` exposes the inner envelope and hash.
Changes to returned XDR objects do not alter the transaction. Construct a new
transaction to change its contents before signing.

An XDR envelope does not identify its network. Parse it with the intended network;
the same envelope produces different hashes and signing bytes on different networks.
Store the network alongside an envelope saved for later approval or signing.

## Before signing

Parsing does not verify whether the network will accept a transaction or whether
its signers are authorized. `XlmSignedTransaction` means the envelope contains
signatures; they may be invalid or insufficient to meet the account's thresholds.
A fee bump can have an unsigned outer envelope around a signed inner transaction.

Evaluate the full operation list, all sources, fee commitments and preconditions.
Soroban exposes contract calls and authorization trees; its eventual effects depend
on contract code and ledger state. A successful parse is insufficient to classify
an arbitrary contract invocation as a simple transfer.

The default signer uses in-memory Ed25519 keys. For remote or threshold keys, build
a signer with `XlmSigners.builder(fallback)` and supply it through
`XlmProvider.builder().signer(...)`. Each new signature is verified against its key
and transaction before attachment. Signing an existing `XlmSignedTransaction`
appends a signature; the caller must still check the signer's authorization.
