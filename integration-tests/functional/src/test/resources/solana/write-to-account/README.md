# Agave write-to-account program

The unmodified prebuilt SBF program and `lib.rs` come from
[Agave 3.1.8, commit 2717084afeeb7baad4342468c27f528ef617a3cf](https://github.com/anza-xyz/agave/tree/2717084afeeb7baad4342468c27f528ef617a3cf/svm/tests/example-programs/write-to-account).
The upstream Apache-2.0 license is included in `LICENSE`.

`write_to_account_program.so` is 21,992 bytes. Its SHA-256 is
`9e4a0a572d33cea6c445d6ab04d4ef8cc1f2405d6a4146bdf162c4008149016c`;
the integration test checks it before deployment. To fetch the same artifact again,
run these commands from this directory:

```bash
curl -fL https://raw.githubusercontent.com/anza-xyz/agave/2717084afeeb7baad4342468c27f528ef617a3cf/svm/tests/example-programs/write-to-account/write_to_account_program.so -o write_to_account_program.so
echo '9e4a0a572d33cea6c445d6ab04d4ef8cc1f2405d6a4146bdf162c4008149016c  write_to_account_program.so' | shasum -a 256 -c -
```

`SolanaProgramsTest` deploys it once per validator through real signed RPC
transactions: create/initialize a loader-v3 buffer, write the ELF in chunks, then
create the program and deploy from the buffer. The test compares the on-chain
ProgramData bytes to this artifact before invoking the program. No Rust/SBF
toolchain, Solana CLI, external RPC or program download is needed during tests.

The first account is the program-owned state account. One-byte instructions used
by the scenarios are `0` (log account size), `1` (write `100` to its first byte),
and `255` (return `InvalidArgument`). Tests cover successful simulation without
persisting writes, confirmed state changes, readonly-account rejection during
preflight, and atomic rollback with a charged fee after a confirmed program error.

Deployment instruction layouts follow the official
[loader-v3 interface](https://docs.rs/solana-loader-v3-interface/5.0.0/src/solana_loader_v3_interface/instruction.rs.html).
The loader helpers are private test setup, not a public deployment API.
