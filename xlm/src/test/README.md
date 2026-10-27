# XLM tests

The XLM suite targets the Protocol 29 schema pinned by Stellar Core v29.0.0:
[`stellar-xdr` at 9c9c145953e80990d6ff1ae3a6a973a0ce6d0694](https://github.com/stellar/stellar-xdr/tree/9c9c145953e80990d6ff1ae3a6a973a0ce6d0694).
The binary and text encodings follow [RFC 4506](https://www.rfc-editor.org/rfc/rfc4506),
[RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) and
[SEP-23](https://github.com/stellar/stellar-protocol/blob/1ae39233055a0fb94bb737650a39ede8d77d924c/ecosystem/sep-0023.md).
Signing uses PureEd25519 from [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032).

## Requirements and tests

Unit and property test classes are under
[`java/org/exploit/signet/xlm`](java/org/exploit/signet/xlm).
Node scenarios are under
[`integration-tests/functional`](../../../integration-tests/functional/src/test/java/org/exploit/signet/test/functional/xlm).

| Requirement | Observable checks | Test classes |
| --- | --- | --- |
| Seed → public key → G address | 50 published SEP-5 seed/address pairs; exact raw public keys, account factory and address API; destroyed keys cannot be reused | `XlmKeyVectorsTest` |
| Canonical StrKey | Published valid/invalid SEP-23 examples; version and checksum rejection; ASCII alphabet, Unicode aliases and single-character corruption | `XlmAddressesTest`, `XlmCodecProperties` |
| Muxed accounts | Independent SDK vectors for IDs 0, 1, 2³²−1, 2⁶³−1, 2⁶³ and 2⁶⁴−1; G account preservation, XDR byte order, distinct routing IDs, rejection outside uint64 | `XlmAddressesTest`, `XlmCodecProperties` |
| XDR scalar representation | Exact big-endian uint32 and signed/unsigned 64-bit boundary bytes; two's complement; opaque bytes and zero padding | `XlmXdrCodecTest`, `XlmTransactionParserTest` |
| Canonical envelope encoding | Exact independent envelope/operation/memo bytes and hashes; every truncated prefix; trailing bytes, unknown nested union arms, invalid optional booleans, Base64 whitespace/missing padding/nonzero pad bits | `XlmTransactionParserTest` |
| Protocol field bounds | Empty and maximum byte lengths plus one byte over for memo, data name/value, home domain, signer payload and Soroban symbol; oversized paths, extra signers and claimants with complete payloads; 100/101 operations and 20/21 signatures | `XlmProtocolLimitsTest`, `XlmTransactionParserTest`, `XlmSignersTest` |
| Parser input limits | Oversized input, excessive recursive SCVal nesting, random bytes and mutations of valid envelopes return the documented parse error or preserve all input bytes | `XlmTransactionParserTest`, `XlmCodecProperties` |
| All operation families | Every one of the 27 operation discriminants; all three envelope types, memo and precondition variants; Classic assets, nested claim predicates, pool shares and signer sponsorship | `XlmTransactionParserTest` |
| Soroban structures | Every SCVal, SCAddress, HostFunction and SignerKey discriminant in the Protocol 29 schema; all four credential arms, nested invocations/delegates, creation authorization functions, footprints and resource extensions | `XlmTransactionParserTest` |
| Network and signing domains | Fixed SHA-256 IDs of the three configured networks; exact passphrases; V0/V1 signing equivalence; inner/outer fee-bump separation; malformed Unicode rejection | `XlmNetworkTest`, `XlmSigningProperties`, `XlmSignersTest` |
| Ed25519 integration | Published RFC 8032 TEST 1/2 through signer dispatch; independent SDK signatures for V0/V1/fee bump; JDK Ed25519 verification over the transaction digest; rejection over raw payload, double hash, changed fields or another network | `XlmSignersTest`, `XlmSigningProperties` |
| Signature attachment | Additional signatures preserve ordinary transaction hashes; fee-bump hashes commit to inner signatures and exclude outer signatures; duplicate, wrong-key, corrupt, wrong-length and excess signatures fail | `XlmSignersTest` |
| Immutable signing input | Mutating constructor inputs, exported XDR objects, signature arrays or digest bytes leaves retained bytes and hashes unchanged | `XlmTransactionParserTest`, `XlmMemoTest` |
| Amounts and reserves | Positive int64 intent bounds; exact stroops without rounding; sponsored-entry reserve invariance, sponsoring costs and liabilities; no negative spendable balance | `XlmIntentsTest`, `XlmReserveProperties`, `XlmPaymentsTest` |
| Native execution and conservation | G/M payments, with-fee budgeting, 100-operation batches, actual fees, exact reserve boundaries, minimum account creation, selling liabilities and ledger lookup | `XlmPaymentsTest` |
| Failure and authorization | Atomic rollback with charged fee/consumed sequence; replay, stale sequence, expiry and wrong-network rejection; weighted multisig, channel/operation sources, fee payer, sponsored reserves and memo requirements | `XlmPaymentsTest`, `XlmAuthorizationTest` |

## Fixtures and execution

[`vectors/README.md`](resources/vectors/README.md) records fixture
provenance and regeneration commands. RFC 8032, SEP-5 and SEP-23 expectations are published
vectors. Transaction and muxed-address expectations come from the independent
SDF JavaScript SDK 17.4.0. Normal test runs use only checked-in fixtures.

```bash
./gradlew :xlm:test
./gradlew :integration-tests:functional:xlmTest
```

Run from the repository root. The integration suite requires JDK 25, Docker and
Docker Compose V2; unit and property tests do not require Docker.

The integration suite starts a digest-pinned local Stellar Protocol 29 network.
It submits through the provider, waits for confirmation, checks ledger results,
and reconciles balances and actual fees. Admission failures and confirmed
execution failures have separate state assertions.

## Scope

The parser validates structure and preserves signed data. On-chain authorization,
thresholds, positive operation amounts and operation semantics require policy and
ledger state. Signed int64 boundary fixtures include values that a node would
reject. A signature-bearing envelope can also contain a HashX preimage with a
length other than 64 bytes; parsing does not establish authorization.

Soroban fixtures validate decoding and signing representation. Deployment,
simulation, resource estimation and contract effects require a separate execution
suite when those operations gain high-level factory support. The supplied factory
prepares native XLM payments and account creation.

SEP-5 fixtures begin with published raw seeds. Mnemonic and HD path derivation are
outside the XLM provider. Ed25519 primitive conformance belongs to shared crypto
support; the XLM tests verify key handling, address encoding and Stellar signing
integration against independent expectations. Later protocol versions require
their own compatibility checks.
