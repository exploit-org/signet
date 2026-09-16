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
    const authorization = await wallet.authorize({ chainId: 1n, nonce: 0, address: entry.address });
    for (const type of [0, 3, 4]) {
        const tx = {
            type, chainId: type === 0 ? 0n : 1n, nonce: 9, gasLimit: 100000n,
            to: '0x3535353535353535353535353535353535353535', value: 123n, data: '0x00aabb',
            ...(type === 0 ? { gasPrice: 20000000000n } : {
                maxPriorityFeePerGas: 1000000000n, maxFeePerGas: 20000000000n, accessList: [entry, entry]
            }),
            ...(type === 3 ? { maxFeePerBlobGas: 7n, blobVersionedHashes: ['0x01' + '23'.repeat(31)] } : {}),
            ...(type === 4 ? { authorizationList: [authorization] } : {})
        };
        const unsigned = Transaction.from(tx);
        const signed = await wallet.signTransaction(tx);
        const fields = { ...tx, chainId: type === 0 ? null : tx.chainId };
        if (type === 4) fields.authorizationList = [{
            chainId: authorization.chainId, nonce: authorization.nonce, address: authorization.address.toLowerCase(),
            yParity: authorization.signature.yParity, r: authorization.signature.r, s: authorization.signature.s
        }];
        vectors.push({ name: `type-${type}-unsigned`, ...fields, sender: wallet.address,
            signingData: unsigned.unsignedSerialized, signingHash: unsigned.unsignedHash,
            signed, hash: Transaction.from(signed).hash });
    }
    console.log(JSON.stringify(vectors, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
})();
