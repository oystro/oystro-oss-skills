# Enable local secret-scanning hooks in THIS clone (Windows / PowerShell).
# Run once after cloning:  ./scripts/setup-hooks.ps1
# Safe to re-run. core.hooksPath is local git config (never committed).

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'githooks/pre-push')) {
    Write-Error 'githooks/ not found - run this from the repository root.'
    exit 1
}

git config core.hooksPath githooks
Write-Host 'OK: local hooks enabled in this clone (core.hooksPath=githooks).'
Write-Host '    pre-commit: sensitive filename guard + staged secret scan'
Write-Host '    pre-push  : scans commits being pushed (fail-closed)'

if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
    Write-Warning 'gitleaks is NOT installed. pre-push will FAIL CLOSED (push blocked)'
    Write-Warning 'until you install it:  winget install Gitleaks.Gitleaks'
}
