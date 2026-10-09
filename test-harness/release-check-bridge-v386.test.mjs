import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Ver.386: PowerShell release entrypoint delegates to the existing source-of-truth Node contracts', () => {
  const shell = read('release-check.ps1');
  const contracts = [
    'release-contract.test.mjs',
    'patch-responsibility.test.mjs',
    'version-source-v194.test.mjs',
    'first-paint-version-handoff-v276.test.mjs'
  ];
  for (const name of contracts) {
    assert.ok(shell.includes(name), 'PowerShell must run: ' + name);
    assert.ok(fs.existsSync(path.join(root, 'test-harness', name)), 'missing contract: ' + name);
  }
  assert.match(shell, /Get-Command 'node'/);
  assert.match(shell, /--test @contractFiles/);
  assert.match(shell, /\$LASTEXITCODE/);
  assert.match(shell, /throw "Release verification failed:/);
  assert.doesNotMatch(shell, /if \(\$cache -ne \$version\)/,
    'stale HTML cache == current release rule must not return');
  assert.doesNotMatch(shell, /if \(\$html -notmatch "Ver\\\.\$version"\)/,
    'stale first-paint HTML version == release rule must not return');
});

test('Ver.386: secondary README points to current guide, not obsolete release 141', () => {
  const secondary = read('.github/README.md');
  const rootReadme = read('README.md');
  assert.match(secondary, /\(\.\.\/README\.md\)/);
  assert.match(secondary, /release-manifest\.js/);
  assert.match(secondary, /patch-responsibilities\.json/);
  assert.match(secondary, /Ver\.143/);
  assert.match(secondary, /500c5f2c785fc65845c68fb5d5b608bd340888a9\/\.github\/README\.md/);
  assert.doesNotMatch(secondary, /現在のバージョン：Ver\.141/);
  assert.match(rootReadme, /release-check\.ps1/);
  assert.match(rootReadme, /患者情報/);
});

test('Ver.386: CI invokes PowerShell release checks after the existing protocol suite', () => {
  const ci = read('.github/workflows/regression-checks.yml');
  const protocol = ci.indexOf('run: npm run test:protocol');
  const powershell = ci.indexOf('run: ./release-check.ps1');
  assert.ok(protocol >= 0 && powershell > protocol, 'PowerShell check must run after Node Protocol');
  assert.match(ci, /shell:\s*pwsh/);
  assert.match(ci, /needs:\s*\[protocol,\s*browser,\s*firebase\]/);
});
