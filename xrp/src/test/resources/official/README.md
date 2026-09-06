# XRPL vectors

Upstream revision: `XRPLF/xrpl.js@d23b2bf5aebe62d40159fedbf5e7b53c4036f6a9`.
The upstream packages are ISC licensed; `LICENSE` and `LICENSE-codec` contain their notices.

- `keypairs.json` is the unmodified published
  [ripple-keypairs fixture](https://github.com/XRPLF/xrpl.js/blob/d23b2bf5aebe62d40159fedbf5e7b53c4036f6a9/packages/ripple-keypairs/test/fixtures/api.json).
  It contains public test keys, addresses and message signatures for both curves.
- `historical-payment.json` is entry 0 of `transactions` in the published
  [codec fixture](https://github.com/XRPLF/xrpl.js/blob/d23b2bf5aebe62d40159fedbf5e7b53c4036f6a9/packages/ripple-binary-codec/test/fixtures/codec-fixtures.json),
  with JSON whitespace reformatted. It verifies exact Payment serialization and
  rejection of its historical high-S signature by the current strict signer/parser.
- `sdk-payments.json` contains expectations generated independently by
  `ripple-binary-codec 2.10.0` and `ripple-keypairs 3.0.0`, not published vectors.
  It pins unsigned bytes, signing preimages, curve-specific signing bytes,
  signatures, signed blobs and transaction IDs. Cases include absent flags/tags,
  tag zero, uint32 maxima, zero fee and the maximum XRP supply in drops.

Regenerate the SDK expectations from `xrp/src/test/oracle` with
`npm ci --ignore-scripts && npm run generate`. The lockfile pins all dependencies.
Normal Gradle tests read committed fixtures and require neither Node.js nor downloads.
The generator also prints the public standalone genesis key used by integration
fixtures; no production secrets are involved.

SHA-256:

```text
2f87ff9d2a337b4f454736a3060e3abdbd9d3ca71e410a38ebcd572fd06b279f  keypairs.json
f62caf01b4884d080c19f5df28fd83f34dc3b17047a7c29b532b63a60141276b  historical-payment.json
ab492e0c16679e7160e56f6fc3c31c0d6e5006fd98a73f61374d0b103b1a4420  sdk-payments.json
8a1d288b9d4a73276758e39890631a7165a18ba6442483e473bf895dd310af13  LICENSE
0cc6523c3b7c398ae0c493a766f4136e1a5c697757c4e16ad8cf0cfc8656b7e6  LICENSE-codec
```
