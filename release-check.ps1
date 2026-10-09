# This entry point is intentionally compatible with Windows PowerShell 5.1 and PowerShell 7.
# Source of truth: release-manifest.js + Node release/ownership/first-paint contracts.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
  throw 'Node.js is required for release verification. Install Node.js 24 and retry.'
}

$contractFiles = @(
  'test-harness/release-contract.test.mjs',
  'test-harness/patch-responsibility.test.mjs',
  'test-harness/version-source-v194.test.mjs',
  'test-harness/first-paint-version-handoff-v276.test.mjs'
)
foreach ($file in $contractFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $file) -PathType Leaf)) {
    throw "Release contract missing: $file"
  }
}

Push-Location -LiteralPath $root
try {
  & $nodeCommand.Source --test @contractFiles
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "Release verification failed: Node test runner exit code $exitCode."
  }
}
finally {
  Pop-Location
}
Write-Output 'Release verification passed (manifest, asset paths, responsibility ledger, first-paint handoff).'
