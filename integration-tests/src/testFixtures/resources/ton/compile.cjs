const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { compileFunc } = require('@ton-community/func-js');

async function main() {
    const source = fs.readFileSync(path.join(__dirname, 'counter.fc'), 'utf8');
    const result = await compileFunc({ targets: ['counter.fc'], sources: { 'counter.fc': source } });

    if (result.status !== 'ok')
        throw new Error(result.message);

    const artifact = {
        compiler: '@ton-community/func-js@0.11.0',
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        code: result.codeBoc
    };

    fs.writeFileSync(path.join(__dirname, 'counter.json'), JSON.stringify(artifact, null, 2) + '\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
