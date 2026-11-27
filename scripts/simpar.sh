#!/bin/sh
# Simulador em paralelo: 4 processos por nível de meta (0, 2 e 4), seeds diferentes.
#   sh scripts/simpar.sh [runs por processo]
N=${1:-5}
TMP=$(mktemp -d)
for m in 0 2 4; do
  for k in 0 1 2 3; do
    SEED0=$((1000 + k * 100)) JSON=1 npx tsx scripts/simulate.ts "$N" "$m" > "$TMP/m$m.$k" 2>/dev/null &
  done
done
wait
for m in 0 2 4; do cat "$TMP"/m$m.* | python scripts/simagg.py "meta $m"; done
rm -rf "$TMP"
