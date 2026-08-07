param([string]$HarnessConfig = (Join-Path $PSScriptRoot 'test-config.example.js'))

$ErrorActionPreference = 'Stop'
$text = Get-Content -LiteralPath $HarnessConfig -Raw -Encoding utf8
$html = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'index.html') -Raw -Encoding utf8
if ($text -notmatch 'WORK_BOARD_TEST\s*=\s*Object\.freeze\(\{\s*emulator:\s*true') { throw 'Harness requires the app-compatible WORK_BOARD_TEST emulator flag.' }
if ($text -notmatch 'host:\s*["''](?:127\.0\.0\.1|localhost)["'']') { throw 'Harness requires a localhost Emulator host.' }
if ($text -notmatch 'port:\s*9000') { throw 'Harness requires the RTDB Emulator port.' }
if ($text -notmatch 'roomId\s*:\s*["'']test-') { throw 'Harness requires a test- room ID.' }
if ($text -match 'task-kanri-2ad16|firebaseio\.com') { throw 'Harness rejected a production Firebase URL.' }
if ($html -match '(?:\.\./)?config\.js') { throw 'Harness HTML must not load the production config.js.' }
'Production rejection guard: passed.'
