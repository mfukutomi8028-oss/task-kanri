$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Get-Content -LiteralPath (Join-Path $root 'release-manifest.js') -Raw -Encoding utf8
if ($manifest -notmatch 'version:\s*"(\d+)"') { throw 'Release manifest version is missing.' }
$version = $Matches[1]
$mismatches = @()
$assetNames = [regex]::Matches($manifest, '"((?:assets/)?[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*)"') |
  ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -match '\.(?:js|css|png|html)$' } |
  Select-Object -Unique
foreach ($asset in $assetNames) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $asset))) { $mismatches += "manifest asset missing: $asset" }
}

$html = Get-Content -LiteralPath (Join-Path $root 'index.html') -Raw -Encoding utf8
$staticUrls = [regex]::Matches($html, '(?:src|href)="([^"?#]+)(?:\?v=(\d+))?"')
foreach ($match in $staticUrls) {
  $asset = $match.Groups[1].Value
  $cache = $match.Groups[2].Value
  if ($asset -match '^(?:https?:|//)') { continue }
  if ($asset -notin $assetNames) { $mismatches += "HTML asset absent from manifest: $asset" }
  if ($cache -ne $version) { $mismatches += "index.html cache=$cache for $asset" }
}

$config = Get-Content -LiteralPath (Join-Path $root 'config.js') -Raw -Encoding utf8
foreach ($token in @('INVENTORY.dynamicStyles', 'INVENTORY.dynamicScripts', 'INVENTORY.mobileScripts', 'assetUrl = name =>')) {
  if ($config -notmatch [regex]::Escape($token)) { $mismatches += "config dynamic manifest loader missing: $token" }
}
if ($config -match '[?&]v=\d+') { $mismatches += 'config contains a fixed cache version' }
if ($html -notmatch "Ver\.$version") { $mismatches += 'index.html display version missing' }
foreach ($readme in @('README.md', '.github/README.md')) {
  if ((Get-Content -LiteralPath (Join-Path $root $readme) -Raw -Encoding utf8) -notmatch "Ver\.$version") { $mismatches += "$readme current version missing" }
}
if ($mismatches.Count) { throw "Release version mismatch: $($mismatches -join '; ')" }
"Release ${version}: manifest, caches, display and READMEs match."
