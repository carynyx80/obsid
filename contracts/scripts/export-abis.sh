#!/usr/bin/env bash
# Builds the contracts and exports { "abi": [...], "bytecode": "0x..." } for every deployable/interacted
# contract into ../frontend/lib/contracts/<Name>.json (consumed by the browser deploy page / dapp).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$HERE/../frontend/lib/contracts"
FORGE="${FORGE:-$(command -v forge || echo /Users/mac/.local/bin/forge)}"

CONTRACTS=(
  VestingVault
  ParticipationBadge
  AllocationMarket
  LiquidityLocker
  SealedBidSale
  MilestoneEscrow
  SaleFactory
  ObsidStaking
)

cd "$HERE"
"$FORGE" build --force >/dev/null 2>&1 || { "$FORGE" build; exit 1; }
mkdir -p "$OUT_DIR"

for name in "${CONTRACTS[@]}"; do
  artifact="$HERE/out/$name.sol/$name.json"
  if [[ ! -f "$artifact" ]]; then
    echo "missing artifact: $artifact" >&2
    exit 1
  fi
  jq '{abi: .abi, bytecode: .bytecode.object}' "$artifact" > "$OUT_DIR/$name.json"
  size=$(( ($(jq -r '.deployedBytecode.object' "$artifact" | wc -c) - 3) / 2 ))
  echo "exported $name (runtime ${size} bytes) -> $OUT_DIR/$name.json"
done
