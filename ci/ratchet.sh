#!/usr/bin/env bash
# Ratchet — migration debt can only go down.
#
# Two counters, stored in .ratchet/:
#   js-count   number of .js/.jsx files under SRC
#   any-count  number of `: any` / `as any` / `<any>` in .ts/.tsx under SRC
#
# Usage:
#   bash ci/ratchet.sh            # check + lower the ceiling (CI mode)
#   bash ci/ratchet.sh --check    # check only, do not write
#   bash ci/ratchet.sh --init     # write current numbers as the baseline
#
# Env: SRC (default: src), RATCHET_DIR (default: .ratchet)
set -euo pipefail

SRC="${SRC:-src}"
DIR="${RATCHET_DIR:-.ratchet}"
MODE="${1:-commit}"

count_js() {
  find "$SRC" \( -name '*.js' -o -name '*.jsx' \) -type f \
    -not -path '*/node_modules/*' -not -name '*.test.js' -not -name '*.spec.js' \
    -not -name '*.test.jsx' -not -name '*.spec.jsx' | wc -l | tr -d ' '
}

count_any() {
  # grep -c per file → sum; no .ts files → 0
  local total=0
  while IFS= read -r f; do
    n=$(grep -cE ':\s*any\b|\bas any\b|<any>' "$f" || true)
    total=$((total + n))
  done < <(find "$SRC" \( -name '*.ts' -o -name '*.tsx' \) -type f -not -path '*/node_modules/*' -not -name '*.d.ts')
  echo "$total"
}

CUR_JS=$(count_js)
CUR_ANY=$(count_any)

if [ "$MODE" = "--init" ]; then
  mkdir -p "$DIR"
  echo "$CUR_JS"  > "$DIR/js-count"
  echo "$CUR_ANY" > "$DIR/any-count"
  echo "ratchet: baseline written — js: $CUR_JS, any: $CUR_ANY"
  exit 0
fi

if [ ! -f "$DIR/js-count" ] || [ ! -f "$DIR/any-count" ]; then
  echo "ratchet: no baseline in $DIR — run: bash ci/ratchet.sh --init" >&2
  exit 2
fi

BASE_JS=$(cat "$DIR/js-count")
BASE_ANY=$(cat "$DIR/any-count")

echo "ratchet: js $CUR_JS (ceiling $BASE_JS) | any $CUR_ANY (ceiling $BASE_ANY)"

# Rules:
#   1. .js/.jsx count never goes up.
#   2. `any` may only go up in a change that converts files (js count went down) —
#      it is counted and shown at the human gate. Any other change may only lower it.
FAIL=0
if [ "$CUR_JS" -gt "$BASE_JS" ]; then
  echo "❌ ratchet: .js/.jsx file count went UP ($BASE_JS → $CUR_JS)"; FAIL=1
fi
if [ "$CUR_ANY" -gt "$BASE_ANY" ]; then
  if [ "$CUR_JS" -lt "$BASE_JS" ]; then
    echo "ℹ️  ratchet: +$((CUR_ANY - BASE_ANY)) 'any' introduced by conversion (allowed, counted)"
  else
    echo "❌ ratchet: 'any' count went UP ($BASE_ANY → $CUR_ANY) without converting any file"; FAIL=1
  fi
fi
[ "$FAIL" -eq 0 ] || exit 1

if [ "$MODE" = "--check" ]; then
  echo "✅ ratchet: ok (check only)"
  exit 0
fi

# Ratchet down: today's numbers are tomorrow's ceiling.
echo "$CUR_JS"  > "$DIR/js-count"
echo "$CUR_ANY" > "$DIR/any-count"
echo "✅ ratchet: ok — ceiling lowered to js $CUR_JS, any $CUR_ANY"
