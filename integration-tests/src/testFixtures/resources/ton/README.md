# TON contract fixture

`counter.fc` is a Signet-owned test contract, under the repository's Apache-2.0 license.
It stores an owner address and a uint64 counter. Opcode 1 increments the counter;
opcode 2 writes and then throws to test rollback. Both messages contain a uint64 query
ID and uint32 delta. Only the owner may write. `get_counter` reads the counter and
`add` demonstrates a getter argument without persisting changes.

`counter.json` contains committed BOC bytecode and the source SHA-256. Gradle test runs
do not download sources or invoke the compiler. It is compiled with
`@ton-community/func-js` 0.11.0 (MIT), pinned in the TON vector package lockfile.

To regenerate from the repository root:

```sh
npm ci --ignore-scripts --prefix ton/src/test/resources/vectors
NODE_PATH="$PWD/ton/src/test/resources/vectors/node_modules" node integration-tests/src/testFixtures/resources/ton/compile.cjs
```

`TonContractsTest` deploys this bytecode through Signet with V4R2 and V5R1 and invokes
it through those wallets and Highload V3. It checks Highload's unsupported direct
StateInit rejection before broadcast, updates, typed getters, read-only evaluation, unauthorized writes,
and confirmed destination failure with storage rollback. Sender acceptance and
destination execution are checked as separate transactions.
