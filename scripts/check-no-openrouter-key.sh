#!/usr/bin/env bash
# AI-11 enforcement (Phase 23 Plan 23-10).
#
# Fails the build if an OpenRouter API key pattern (`sk-or-...`) is detected
# anywhere inside the frontend bundle. The OpenRouter key MUST stay
# server-side in `recontrol_backend/.env` — the frontend talks to the Rails
# `/scenarios/drafts` endpoint, never directly to OpenRouter.
#
# Usage: ./scripts/check-no-openrouter-key.sh [dist-dir]   # default: dist
#
# Exit codes:
#   0 — clean (no key pattern found)
#   1 — key pattern detected in bundle (build MUST fail)
#   2 — dist directory missing (run `npm run build` first)
set -euo pipefail

DIST="${1:-dist}"

if [ ! -d "$DIST" ]; then
  echo "::error::dist directory '$DIST' not found; run 'npm run build' first" >&2
  exit 2
fi

if grep -rE 'sk-or-[A-Za-z0-9_-]{20,}' "$DIST"; then
  echo "::error::OpenRouter API key pattern detected in '$DIST' — failing build (AI-11)" >&2
  exit 1
fi

echo "No OpenRouter key pattern found in '$DIST'. OK."
exit 0
