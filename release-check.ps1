$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Get-Content -LiteralPath (Join-Path $root 'release-manifest.js') -Raw -Encoding utf8
$html = Get-Content -LiteralPath (Join-Path $root 'index.html') -Raw -Encoding utf8
if ($manifest -notmatch 'version:\s*"(\d+)"') { throw 'Release manifest version is missing.' }
$version = $Matches[1]
$mismatches = [regex]::Matches($html, '[?&]v=(\d+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne $version }
if ($mismatches) { throw "HTML cache version differs from manifest: $($mismatches -join ', ')" }
"Release ${version}: HTML cache values match manifest."
