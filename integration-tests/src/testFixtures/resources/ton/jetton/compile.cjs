const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { compileFunc } = require('@ton-community/func-js');

async function compile(target) {
    const targets = ['stdlib.fc', 'ft/params.fc', 'ft/op-codes.fc', 'ft/discovery-params.fc',
        'ft/jetton-utils.fc', `ft/${target}.fc`];
    const sources = Object.fromEntries(targets.map(file => [file, fs.readFileSync(path.join(__dirname, file), 'utf8')]));
    const result = await compileFunc({ targets, sources });
    if (result.status !== 'ok')
        throw new Error(result.message);

    return {
        sources: Object.fromEntries(Object.entries(sources).map(([file, text]) =>
            [file, createHash('sha256').update(text).digest('hex')])),
        code: result.codeBoc
    };
}

async function main() {
    const artifact = {
        revision: '1182ad99413242f09925d50e70ccb7e0e09f94d4',
        compiler: '@ton-community/func-js@0.11.0',
        master: await compile('jetton-minter-discoverable'),
        wallet: await compile('jetton-wallet')
    };
    fs.writeFileSync(path.join(__dirname, 'jetton.json'), JSON.stringify(artifact, null, 2) + '\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
