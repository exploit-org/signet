#!/usr/bin/env python3
"""Regenerate standard-script fixtures using the pinned Bitcoin Core reference.

Pass Bitcoin Core's test/functional directory from commit
4519933391dd23dbf1a4eceec6dd53d2e9e71cc3. No Signet implementation is used.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("core_functional", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.core_functional))

    from test_framework.messages import CTransaction
    from test_framework.script import CScript, LegacySignatureHash, SegwitV0SignatureHash

    source = Path(__file__).parents[1] / "resources/vectors/bitcoin-core/sighash.json"
    vectors = json.loads(source.read_text())
    assert len(vectors) == 501
    results = []

    for index, (raw, script, input_index, hash_type, expected) in enumerate(vectors[1:], 1):
        transaction = CTransaction()
        transaction.deserialize(io.BytesIO(bytes.fromhex(raw)))
        digest, _ = LegacySignatureHash(CScript(bytes.fromhex(script)), transaction,
                                        input_index, hash_type & 0xffffffff)
        assert digest[::-1].hex() == expected, f"Core reference disagrees with vector {index}"

        # Canonical P2PKH scriptCode is also the scriptCode for P2WPKH.
        payload = hashlib.sha256(index.to_bytes(4, "little")).digest()[:20]
        script_code = CScript(b"\x76\xa9\x14" + payload + b"\x88\xac")
        amount = index * 1_000_003
        legacy = {}
        segwit = {}
        for mode in (1, 2, 3, 129, 130, 131):
            digest, _ = LegacySignatureHash(script_code, transaction, input_index, mode)
            legacy[str(mode)] = digest.hex()
            segwit[str(mode)] = SegwitV0SignatureHash(
                script_code, transaction, input_index, mode, amount
            ).hex()

        results.append({"coreVectorIndex": index, "scriptCode": script_code.hex(),
                        "amountSats": amount, "legacy": legacy, "segwitV0": segwit})

    args.output.write_text(json.dumps(results, indent=2) + "\n")
    print(f"Verified {len(results)} original vectors; generated {len(results) * 12} standard sighashes")


if __name__ == "__main__":
    main()
