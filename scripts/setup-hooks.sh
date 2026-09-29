#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Enable local secret-scanning hooks in THIS clone (opt-in, per clone).
# Run once after cloning:  ./scripts/setup-hooks.sh
# Safe to re-run. core.hooksPath is local git config (never committed).
# Windows: run from Git Bash, or use PowerShell:  ./scripts/setup-hooks.ps1
# ==============================================================================

if [ ! -d githooks ] || [ ! -x githooks/pre-push ]; then
  echo "❌ githooks/ not found — run this from the repository root." >&2
  exit 1
fi

git config core.hooksPath githooks
chmod +x githooks/* scripts/scan-secrets.sh 2>/dev/null || true

echo "✅ Local hooks enabled in this clone (core.hooksPath=githooks)."
echo "   pre-commit : blocks sensitive filenames + scans staged content"
echo "   pre-push   : scans the commits being pushed (fail-closed)"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "⚠️  gitleaks is NOT installed."
  echo "    pre-commit scanning will be skipped, and pre-push will FAIL CLOSED"
  echo "    (pushes blocked) until you install it:  brew install gitleaks"
fi
