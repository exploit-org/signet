// Run with ethers@6.15.0 on NODE_PATH; stdout is typed-transactions.json.
const { Transaction, Wallet } = require('ethers');
const wallet = new Wallet('0x' + '46'.repeat(32));
const entry = { address: '0x1111111111111111111111111111111111111111', storageKeys: ['0x' + '22'.repeat(32)] };

(async () => {
    const vectors = [];
    for (const type of [1, 2]) {
        for (const scenario of ['empty', 'access-list', 'creation', 'large-chain-id']) {
            const tx = {
                type, chainId: scenario === 'large-chain-id' ? (1n << 200n) + 1n : 1n,
                nonce: 9, gasLimit: 100000n,
                to: scenario === 'creation' ? null : '0x3535353535353535353535353535353535353535',
                value: 123n, data: scenario === 'creation' ? '0x60006000f3' : '0x00aabb',
                accessList: scenario === 'empty' ? [] : [entry, entry],
                ...(type === 1 ? { gasPrice: 20000000000n }
                    : { maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n })
            };
            const unsigned = Transaction.from(tx);
            const signed = await wallet.signTransaction(tx);
            vectors.push({ name: `type-${type}-${scenario}`, ...tx, sender: wallet.address,
                signingData: unsigned.unsignedSerialized, signingHash: unsigned.unsignedHash,
                signed, hash: Transaction.from(signed).hash });
        }
    }
    console.log(JSON.stringify(vectors, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
})();
