import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { encode, encodeForSigning } from 'ripple-binary-codec';
import { deriveKeypair, deriveAddress, sign } from 'ripple-keypairs';

const keys = JSON.parse(readFileSync(new URL('../resources/official/keypairs.json', import.meta.url)));
const sha512Half = hex => createHash('sha512').update(Buffer.from(hex, 'hex')).digest('hex').slice(0, 64).toUpperCase();
const variants = [
  { Amount: '1', Fee: '12', Sequence: 1 },
  { Amount: '1000000', Fee: '10', Sequence: 2, Flags: 2147483648,
    LastLedgerSequence: 12345, DestinationTag: 0, SourceTag: 4294967295 },
  { Amount: '100000000000000000', Fee: '0', Sequence: 4294967295, Flags: 0,
    LastLedgerSequence: 4294967295, DestinationTag: 4294967295, SourceTag: 0 },
];
const transactions = [];
for (const [algorithm, fixture] of Object.entries(keys)) {
  for (const fields of variants) {
    const tx = { TransactionType: 'Payment', Account: fixture.address,
      Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', SigningPubKey: fixture.keypair.publicKey, ...fields };
    const preimage = encodeForSigning(tx);
    const signature = sign(preimage, fixture.keypair.privateKey);
    const blob = encode({ ...tx, TxnSignature: signature });
    transactions.push({ algorithm, tx, preimage,
      signingBytes: algorithm === 'ed25519' ? preimage : sha512Half(preimage),
      unsigned: encode(tx), signature, blob, hash: sha512Half('54584E00' + blob) });
  }
}
writeFileSync(new URL('../resources/official/sdk-payments.json', import.meta.url),
  JSON.stringify({ oracle: 'ripple-binary-codec 2.10.0 / ripple-keypairs 3.0.0', transactions }, null, 2) + '\n');
const root = deriveKeypair('snoPBrXtMeMyMHUVTgbuqAfg1SUTb');
console.log(JSON.stringify({ ...root, address: deriveAddress(root.publicKey) }));
