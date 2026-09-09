#!/usr/bin/env bash
set -euo pipefail

ton_fixture_dir="$(cd "$(dirname "$0")" && pwd)"
ton_build_dir="${1:-$ton_fixture_dir/../../build/tonapi}"
mkdir -p "$ton_build_dir/source"
ton_build_dir="$(cd "$ton_build_dir" && pwd)"

curl -fsSL https://codeload.github.com/tonkeeper/opentonapi/tar.gz/def8c61d7186d1063c0c8b3a4d5490254a1d26c1 \
    -o "$ton_build_dir/source.tar.gz"
printf '%s  %s\n' 6a81f63449800b95541eb71973038b8ef291f5847db1387a0c75423784783bf8 "$ton_build_dir/source.tar.gz" | shasum -a 256 -c
tar -xzf "$ton_build_dir/source.tar.gz" --strip-components=1 -C "$ton_build_dir/source"
git -C "$ton_build_dir/source" apply "$ton_fixture_dir/local-chain.patch"

cd "$ton_build_dir/source"
go build -o "$ton_build_dir/opentonapi" github.com/tonkeeper/opentonapi/cmd/api
printf 'OpenTonAPI binary: %s\n' "$ton_build_dir/opentonapi"
