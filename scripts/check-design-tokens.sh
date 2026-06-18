#!/bin/sh
set -e

# No raw hex values in src/**/*.{tsx,ts} (excluding assets and intentional dark-surface exceptions)
HEX_MATCHES=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E '#[0-9a-fA-F]{3,8}' \
  src/ \
  | grep -v "src/assets/" \
  | grep -v "^Binary" \
  | grep -v "src/pages/DeviceControl/components/Stream/" \
  | grep -v "src/pages/DeviceControl/components/Layout/MainContent.tsx" \
  | grep -v "src/pages/DeviceControl/DeviceControl.tsx" \
  | grep -vE '^\S+:[0-9]+:[[:space:]]*//' \
  | grep -vE '^\S+:[0-9]+:[[:space:]]*\*' \
  | grep -vE '&#[0-9]+;' \
  | wc -l | tr -d ' ')

# No stock palette classes in src/**/*.tsx
PALETTE_MATCHES=$(grep -rn --include="*.tsx" \
  -E '(text|bg|border|ring|from|to|via)-(gray|red|amber|blue|indigo|green|yellow|orange|purple|pink|teal|cyan|emerald|violet|rose|sky|lime|slate|zinc|neutral|stone|fuchsia)-[0-9]+' \
  src/ \
  | wc -l | tr -d ' ')

if [ "$HEX_MATCHES" -gt 0 ] || [ "$PALETTE_MATCHES" -gt 0 ]; then
  echo "ERROR: Found raw hex or stock palette class usage."
  echo "  Raw hex occurrences: $HEX_MATCHES"
  echo "  Stock palette class occurrences: $PALETTE_MATCHES"
  exit 1
fi
echo "Design token check: PASSED"
