const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const artifacts = {};

function compile(compiler, file, content, circle = false, evmVersion = circle ? 'istanbul' : 'shanghai') {
  const usdt = file === 'TetherToken.sol';
  const input = { language: 'Solidity', sources: { [file]: { content } }, settings: {
    optimizer: { enabled: !usdt, runs: usdt ? 0 : 200 }, evmVersion,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.bytecode.linkReferences'] } }
  }};
  const compileJson = compiler.compileStandardWrapper || compiler.compile;
  const output = JSON.parse(compileJson(JSON.stringify(input), { import(name) {
    const location = circle && name.startsWith('@openzeppelin/contracts/')
      ? path.join('node_modules/openzeppelin3', name.slice('@openzeppelin/contracts/'.length))
      : path.join('node_modules', name);
    return { contents: fs.readFileSync(location, 'utf8') };
  }}));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const sources = circle ? [file, 'circle/contracts/util/SignatureChecker.sol'] : [file];
  for (const source of sources) {
    const sourceContent = source === file ? content : fs.readFileSync(path.join('node_modules', source), 'utf8');
    for (const [name, contract] of Object.entries(output.contracts[source])) {
      if (usdt && name !== 'TetherToken') continue;
      if (!contract.evm.bytecode.object) continue;
      artifacts[name] = { source, compiler: compiler.version(),
        sourceHash: crypto.createHash('sha256').update(sourceContent).digest('hex'),
        abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object,
        linkReferences: contract.evm.bytecode.linkReferences };
    }
  }
}

compile(require('solc'), 'TestTokens.sol', fs.readFileSync('TestTokens.sol', 'utf8'));
const circleFile = 'circle/contracts/v2/FiatTokenV2_2.sol';
compile(require('solc6'), circleFile, fs.readFileSync(path.join('node_modules', circleFile), 'utf8'), true);
compile(require('solc4'), 'TetherToken.sol', fs.readFileSync('TetherToken.sol', 'utf8'), false, 'byzantium');
const destination = '../src/testFixtures/resources/evm/contracts.json';
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(artifacts, null, 2) + '\n');
console.log('Compiled ' + Object.keys(artifacts).join(', '));
