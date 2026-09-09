const fs = require('node:fs');
const path = require('node:path');
const { Address, beginCell } = require('@ton/core');

const owner = Address.parse('0:' + '22'.repeat(32));
const recipient = Address.parse('0:' + '33'.repeat(32));
const payload = beginCell().storeUint(0, 32).storeStringTail('Signet Jetton').endCell();
const custom = beginCell().storeUint(42, 32).endCell();

function transfer(forward, payload, custom) {
    return beginCell().storeUint(0x0f8a7ea5, 32).storeUint(7, 64).storeCoins(123456789n)
        .storeAddress(recipient).storeAddress(owner).storeMaybeRef(custom).storeCoins(forward)
        .storeBit(payload !== null).storeBuilder(payload ? beginCell().storeRef(payload) : beginCell()).endCell();
}

const bodies = {
    transfer: transfer(1000000n, payload, custom),
    empty: transfer(0n, null, null),
    burn: beginCell().storeUint(0x595f07bc, 32).storeUint(7, 64).storeCoins(123456789n)
        .storeAddress(owner).storeMaybeRef(null).endCell()
};
fs.writeFileSync(path.join(__dirname, 'jetton.json'), JSON.stringify({
    source: '@ton/core via pinned package-lock.json; TEP-74 message schemas',
    bodies: Object.fromEntries(Object.entries(bodies).map(([name, cell]) => [name, cell.toBoc({ idx: false, crc32: false }).toString('base64')]))
}, null, 2) + '\n');
