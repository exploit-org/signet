#!/usr/bin/env python3
"""Extract published BIP143 examples without recomputing their expected sighashes.

Use bip-0143.mediawiki from BIPs commit 7273e178e52f02de100950f569ae40f485099b58
and test/functional from Core commit 4519933391dd23dbf1a4eceec6dd53d2e9e71cc3.
Core independently checks the extraction and supplies txid/wtxid/weight/vsize.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("core_functional", type=Path)
    parser.add_argument("bip143", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.core_functional))

    from test_framework.messages import CTransaction, hash256
    from test_framework.script import CScript, SegwitV0SignatureHash

    source = args.bip143.read_text()
    pattern = (r"(?:The following is an unsigned transaction:|The serialized signed transaction is:|"
               r"The following transaction is a [^\n]+ examples:|Since SINGLE\|ANYONECANPAY[^\n]+swapped:)"
               r"\s*([0-9a-f]+)")
    transactions = []
    for match in re.finditer(pattern, source):
        raw = match[1]
        transaction = CTransaction()
        transaction.deserialize(io.BytesIO(bytes.fromhex(raw)))
        assert transaction.serialize().hex() == raw
        transactions.append((match.start(), raw, transaction))
    assert len(transactions) == 14

    vectors = []
    for match in re.finditer(r"^  (?:hash )?preimage(?: for [^:]+)?:\s*([0-9a-f]+)", source, re.M):
        _, raw, transaction = next(item for item in reversed(transactions) if item[0] < match.start())
        preimage = bytes.fromhex(match[1])
        expected = re.search(r"^  sighash:\s*([0-9a-f]{64})", source[match.end():], re.M | re.I)[1]
        assert hashlib.sha256(hashlib.sha256(preimage).digest()).hexdigest() == expected
        script_length = preimage[104]
        assert script_length < 0xfd
        assert len(preimage) == 104 + 1 + script_length + 8 + 4 + 32 + 4 + 4
        script = preimage[105:105 + script_length]
        amount = int.from_bytes(preimage[105 + script_length:113 + script_length], "little")
        mode = int.from_bytes(preimage[-4:], "little")
        input_index = next(index for index, txin in enumerate(transaction.vin)
                           if txin.prevout.serialize() == preimage[68:104])
        assert SegwitV0SignatureHash(CScript(script), transaction, input_index, mode, amount).hex() == expected
        vectors.append({"sourceLine": source[:match.start()].count("\n") + 1,
                        "rawTransaction": raw, "inputIndex": input_index, "scriptCode": script.hex(),
                        "amountSats": amount, "hashType": mode, "sigHash": expected})
    assert len(vectors) == 14

    serialized = [{"rawTransaction": raw,
                   "txid": hash256(transaction.serialize_without_witness())[::-1].hex(),
                   "wtxid": hash256(transaction.serialize())[::-1].hex(),
                   "weight": transaction.get_weight(), "virtualSize": transaction.get_vsize()}
                  for _, raw, transaction in transactions]
    args.output.write_text(json.dumps({"signatureHashes": vectors, "transactions": serialized}, indent=2) + "\n")
    print(f"Extracted and independently verified {len(vectors)} BIP143 sighashes and {len(serialized)} transactions")


if __name__ == "__main__":
    main()
