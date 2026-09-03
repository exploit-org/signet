# Bitcoin test vectors

Tests load the checked-in fixtures. Normal Gradle runs need no network, Python,
Bitcoin Core installation, or running node. The Python scripts are only for
deliberate fixture regeneration; they never call Signet to calculate expectations.

## Pinned sources

- Bitcoin Core: [`4519933391dd23dbf1a4eceec6dd53d2e9e71cc3`](https://github.com/bitcoin/bitcoin/tree/4519933391dd23dbf1a4eceec6dd53d2e9e71cc3).
  `bitcoin-core/sighash.json`, `key_io_valid.json`, and `key_io_invalid.json` are
  byte-for-byte copies of `src/test/data/` files. See `bitcoin-core/COPYING`.
- BIPs: [`7273e178e52f02de100950f569ae40f485099b58`](https://github.com/bitcoin/bips/tree/7273e178e52f02de100950f569ae40f485099b58).
  `bip341/wallet-test-vectors.json` is an unchanged copy of
  `bip-0341/wallet-test-vectors.json`. BIP341 is authored by Pieter Wuille,
  Jonas Nick, and Anthony Towns and licensed under BSD-3-Clause; see `bip341/LICENSE`.
  BIP143 is public domain. BIP350 address/script pairs in `SegwitAddressTest`
  come from the same pinned BIPs revision (BIP350 is BSD-2-Clause).

## Coverage and deliberate boundaries

- **Core key I/O:** all 70 valid and 70 invalid entries. Valid WIF vectors check
  exact private-key bytes, compression, network, and re-encoding. Supported
  destination vectors check the exact official scriptPubKey. The eight valid
  future-witness destinations are checked at the codec level and explicitly
  rejected by Signet's current transfer policy, rather than silently skipped.
  Core `testnet4` maps to Signet `TESTNET` for address/WIF encoding only; these
  prefixes also cannot distinguish testnet from signet in Base58.
- **Core transactions:** all 500 `sighash.json` raw transactions are parsed and
  serialized byte-for-byte. The original sighash types are arbitrary 32-bit
  values, none of which is a supported `BitcoinSigHash` enum value. We do not
  claim that Signet computes those original arbitrary-type/arbitrary-script hashes.
- **Core-reference standard sighashes:** `bitcoin-core/standard-sighash.json`
  contains 6,000 independently generated expectations: each of the 500 original
  transaction shapes, all six supported modes, both legacy P2PKH and SegWit v0
  P2WPKH scriptCode. The generator first validates Core's reference against all
  500 original published hashes, then substitutes canonical P2PKH scriptCode and
  supported hash types. These are reference-generated fixtures, not unmodified
  published Core vectors. Expected values are in digest byte order, whereas the
  original Core JSON uses reversed uint256 display order.
- **BIP143:** `bip143/examples.json` extracts all 14 published signature hashes
  and their input fields from the specification's preimages. It includes all six
  modes, missing SINGLE output, executed/unexecuted CODESEPARATOR scriptCode,
  and No FindAndDelete examples. Expectations are copied from the BIP and checked
  against its preimages and Core's independent reference. The 14 raw transactions
  additionally have Core-derived txid, wtxid, weight, and virtual size. This tests
  the generic digest codec, not a P2WSH/multisig transaction signer.
- **BIP341:** all seven address/scriptPubKey vectors use their supplied Merkle
  roots; all seven key-path inputs check exact sighash and signature bytes.
  The official fully signed transaction is parsed and its witnesses/serialization
  checked. Script-tree construction, control blocks, and script-path signing
  are outside the current API. This is not a multi-account signing API test.
- **BIP340 primitive testing:** intentionally excluded; Anvil owns those tests.
- **Consensus acceptance:** Core regtest remains a separate, deferred matrix.

## Regeneration

Use clean checkouts of the exact revisions above. Both generators assert fixture
counts and check extracted/calculated values against independent official data.

```sh
python3 bitcoin/src/test/fixtures/generate_core_sighash.py \
  /path/to/bitcoin/test/functional /tmp/standard-sighash.json
python3 bitcoin/src/test/fixtures/extract_bip143_vectors.py \
  /path/to/bitcoin/test/functional /path/to/bips/bip-0143.mediawiki /tmp/examples.json
```

Review regenerated files before replacing fixtures. Current SHA-256 checksums:

```text
52cf23c2076e7f129c71d5508631d3e5ae3be1b1cb0585c0e23bbb4bb373e924  bitcoin-core/sighash.json
90bd1d35d12763e0d00c5400b2c9fe551e532a821e1e466c20cad3aced70a7fe  bitcoin-core/key_io_valid.json
c3ca74ddad7c01faaca7c26063537feb73ff2be03eb7fc83a42a655d2979261d  bitcoin-core/key_io_invalid.json
76ec61ec18103947bf551895ae95cce11f49aa1b068885a50089eb61c70a1915  bitcoin-core/standard-sighash.json
7b2c18fcbed8ee4c093e10533c1201cd60ae047946d54995977add8b0b62b95b  bip143/examples.json
403e19fb81dd1f31e745699216308f61fb403774b2aafa87b631b8f7c042d37f  bip341/wallet-test-vectors.json
```
