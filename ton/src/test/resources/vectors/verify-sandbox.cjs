const fs = require('node:fs');
const assert = require('node:assert/strict');
const { Blockchain, createShardAccount } = require('@ton/sandbox');
const { Address, Cell, beginCell, loadMessage, toNano } = require('@ton/core');

const messages = JSON.parse(fs.readFileSync(process.argv[2]));
const now = 1800000000;
const initialBalance = toNano('10');

function activeData(vector) {
    const data = Cell.fromBase64(vector.data);

    if (vector.version === 'HIGHLOAD_V3')
        return data;

    const source = data.beginParse();
    const builder = beginCell();

    if (vector.version === 'V5R1')
        builder.storeBit(source.loadBit());

    source.loadUint(32);

    return builder.storeUint(vector.seqno, 32).storeSlice(source).endCell();
}

async function blockchainFor(vector) {
    const blockchain = await Blockchain.create();
    blockchain.now = now;
    blockchain.verbosity = { print: false, blockchainLogs: false, vmLogs: 'none', debugLogs: false };

    const address = Address.parse(vector.address);

    if (vector.deploy) {
        (await blockchain.getContract(address)).balance = initialBalance;
    } else {
        await blockchain.setShardAccount(address, createShardAccount({
            address, code: Cell.fromBase64(vector.code), data: activeData(vector), balance: initialBalance
        }));
    }

    return blockchain;
}

async function verify(vector) {
    const blockchain = await blockchainFor(vector);
    const message = loadMessage(Cell.fromBase64(vector.envelope).beginParse());
    const result = await blockchain.sendMessage(message);
    const transaction = result.transactions[0];

    assert.equal(transaction.description.type, 'generic');
    assert.equal(transaction.description.aborted, false);
    assert.equal(transaction.description.computePhase.type, 'vm');
    assert.equal(transaction.description.computePhase.exitCode, 0);
    assert.equal(transaction.description.actionPhase.resultCode, 0);

    const outgoing = [...transaction.outMessages.values()];
    assert.equal(outgoing.length, 1);
    assert.equal(outgoing[0].info.type, 'internal');
    assert.equal(outgoing[0].info.dest.toRawString(), Address.parse(vector.recipient).toRawString());
    assert.equal(outgoing[0].info.value.coins, BigInt(vector.amount));

    const sender = await blockchain.getContract(Address.parse(vector.address));
    const recipient = await blockchain.getContract(Address.parse(vector.recipient));
    assert.equal(recipient.balance, BigInt(vector.amount));
    assert.equal(initialBalance - sender.balance,
        BigInt(vector.amount) + transaction.totalFees.coins + outgoing[0].info.forwardFee + outgoing[0].info.ihrFee);

    const balance = sender.balance;
    await assert.rejects(() => blockchain.sendMessage(message));
    assert.equal(sender.balance, balance);
    assert.equal(recipient.balance, BigInt(vector.amount));

    const expired = await blockchainFor(vector);
    expired.now = vector.version === 'HIGHLOAD_V3' ? vector.createdAt + 300 : vector.validUntil;
    await assert.rejects(() => expired.sendMessage(message));
    assert.equal((await expired.getContract(Address.parse(vector.address))).balance, initialBalance);
}

async function main() {
    for (const vector of messages)
        await verify(vector);

    console.log(`Verified ${messages.length} Signet messages in TVM: transfer, fees, replay rejection and expiry.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
