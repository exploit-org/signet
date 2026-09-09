const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ton = require('@ton/ton');
const core = require('@ton/core');
const crypto = require('@ton/crypto');

const highloadRoot = process.argv[2];
const output = process.argv[3];

if (!highloadRoot || !output)
    throw new Error('Usage: generate.cjs <pinned-highload-repository> <output.json>');

// Execute the unmodified official wrapper, including its TypeScript imports.
require.extensions['.ts'] = (module, filename) => {
    module.paths.push(path.join(__dirname, 'node_modules'));

    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    });

    module._compile(compiled.outputText, filename);
};

const { HighloadWalletV3 } = require(path.join(highloadRoot, 'wrappers/HighloadWalletV3.ts'));
const highloadCode = core.Cell.fromBoc(Buffer.from(
    JSON.parse(fs.readFileSync(path.join(highloadRoot, 'build/HighloadWalletV3.compiled.json'))).hex, 'hex'
))[0];

const key = crypto.keyPairFromSeed(Buffer.alloc(32, 1));
const now = 1800000000;
const versions = ['V3R1', 'V3R2', 'V4R2', 'V5R1', 'HIGHLOAD_V3'];
const boc = cell => cell.toBoc({ idx: false, crc32: false }).toString('base64');

function wallet(version, network, workchain) {
    const args = { publicKey: key.publicKey, workchain };

    switch (version) {
        case 'V3R1': return ton.WalletContractV3R1.create(args);
        case 'V3R2': return ton.WalletContractV3R2.create(args);
        case 'V4R2': return ton.WalletContractV4.create(args);
        case 'V5R1': return ton.WalletContractV5R1.create({
            publicKey: key.publicKey,
            walletId: {
                networkGlobalId: network === 'MAINNET' ? -239 : -3,
                context: { walletVersion: 'v5r1', workchain, subwalletNumber: 0 }
            }
        });
        case 'HIGHLOAD_V3': return HighloadWalletV3.createFromConfig({
            publicKey: key.publicKey, subwalletId: 0x10ad, timeout: 300
        }, highloadCode, workchain);
    }
}

async function transfer(version, deploy, comment) {
    const w = wallet(version, 'MAINNET', 0);
    const to = new core.Address(0, Buffer.alloc(32, 2));
    const amount = '123456789';
    const seqno = deploy ? 0 : 7;
    const queryId = 1124;
    const createdAt = now - 30;
    const validUntil = now + 60;
    const message = core.internal({ to, value: BigInt(amount), bounce: false, body: comment ?? undefined });
    let signingCell;
    let signature;
    let body;

    if (version === 'HIGHLOAD_V3') {
        await w.sendExternalMessage({ external: async value => { body = value; } }, key.secretKey, {
            message, mode: 3, query_id: BigInt(queryId), createdAt, subwalletId: 0x10ad, timeout: 300
        });

        const slice = body.beginParse();
        signature = slice.loadBuffer(64);
        signingCell = slice.loadRef();
    } else {
        body = await w.createTransfer({
            seqno, timeout: validUntil, sendMode: 3, messages: [message],
            signer: async cell => {
                signingCell = cell;
                signature = crypto.sign(cell.hash(), key.secretKey);
                return signature;
            }
        });
    }

    const envelope = core.beginCell().store(core.storeMessage(core.external({
        to: w.address, init: deploy ? w.init : undefined, body
    }))).endCell();

    const normalized = core.beginCell().store(core.storeMessage(core.external({ to: w.address, body }), {
        forceRef: true
    })).endCell();

    return {
        version, deploy, comment, address: w.address.toRawString(),
        recipient: to.toString({ bounceable: false }), amount,
        seqno: version === 'HIGHLOAD_V3' ? 0 : seqno,
        queryId: version === 'HIGHLOAD_V3' ? queryId : null,
        createdAt: version === 'HIGHLOAD_V3' ? createdAt : 0,
        validUntil: version === 'HIGHLOAD_V3' ? 0 : validUntil,
        signingBoc: boc(signingCell), signingHash: signingCell.hash().toString('hex'),
        signature: signature.toString('hex'), signedBody: boc(body), envelope: boc(envelope),
        messageHash: normalized.hash().toString('hex'),
        code: boc(w.init.code), data: boc(w.init.data)
    };
}

async function main() {
    const addresses = [];

    for (const version of versions) {
        for (const network of ['MAINNET', 'TESTNET']) {
            for (const workchain of [0, -1]) {
                const w = wallet(version, network, workchain);
                const init = core.beginCell().store(core.storeStateInit(w.init)).endCell();

                addresses.push({
                    version, network, workchain, raw: w.address.toRawString(),
                    friendly: w.address.toString({ bounceable: false, testOnly: network === 'TESTNET' }),
                    stateInitHash: init.hash().toString('hex'), codeHash: w.init.code.hash().toString('hex')
                });
            }
        }
    }

    const transfers = [];

    for (const version of versions) {
        transfers.push(await transfer(version, true, null));
        transfers.push(await transfer(version, false, 'Оплата TON'));
    }

    for (const length of [123, 124, 1024])
        transfers.push(await transfer('V5R1', true, 'a'.repeat(length)));

    fs.writeFileSync(output, JSON.stringify({
        sdk: '@ton/ton@16.3.0', highloadRevision: 'f5d9b592bd5ab5c9ae6ca627819929e140f6bd61',
        publicKey: key.publicKey.toString('hex'), now, addresses, transfers
    }, null, 2) + '\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
