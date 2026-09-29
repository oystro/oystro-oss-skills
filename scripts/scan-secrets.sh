#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Working-Tree Secret Scanner (Catches uncommitted & gitignored files)
# ==============================================================================

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "==> Gitleaks CLI not found in PATH."
  echo "    Install via: brew install gitleaks (macOS) or see https://github.com/gitleaks/gitleaks"
  exit 1
fi

echo "==> Scanning working tree for secrets (including gitignored files)..."
echo ""

gitleaks detect --no-git --source . --redact --verbose
