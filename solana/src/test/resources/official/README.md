# Solana vectors

`rfc8032-ed25519.json` contains TEST 1 and TEST 2 from
[RFC 8032 §7.1](https://www.rfc-editor.org/rfc/rfc8032#section-7.1).
The tests compare public keys and complete deterministic Ed25519 signatures.

The short-u16 examples in `SolanaOfficialVectorsTest` are copied from
[`solana-short-vec` 2.2.1](https://docs.rs/crate/solana-short-vec/2.2.1/source/src/lib.rs),
`test_short_vec_encode_len` and `test_deserialize`, including all malformed aliases,
truncation and overflow cases.

`rust-sdk-oracle.json` is a generated compatibility corpus, not an upstream published
test-vector file. It is produced independently of the Java implementation using the
official `solana-sdk` 2.3.1, `spl-token` 8.0.0, `spl-token-2022` 8.0.1 and
`spl-associated-token-account` 7.0.0 crates. Exact transitive versions and checksums
are recorded in `../../oracle/Cargo.lock`.

The corpus covers 64 signed legacy/v0 transactions, 256 PDA derivations, 258 curve
membership checks, 21 System/SPL/ATA instructions, packed mint/token/nonce/ALT accounts,
and 540 transfer-fee calculations across epochs, rounding boundaries, caps and u64 limits.
Java tests compare the complete serialized message, transaction and signature; instruction
checks include every account's order and signer/writable flags.

Regenerate from the repository root with Rust and Cargo:

```bash
cargo run --manifest-path solana/src/test/oracle/Cargo.toml --release --locked > solana/src/test/resources/official/rust-sdk-oracle.json
./gradlew :solana:test
```

Property tests cover Base58 leading zeros, canonical shortvec encoding, unsigned integers,
signed wire round trips and tampering, PDA bump construction and merged account privileges.
They do not require RPC. Stateful behavior belongs in `integration-tests` and runs against
the pinned Agave validator.
