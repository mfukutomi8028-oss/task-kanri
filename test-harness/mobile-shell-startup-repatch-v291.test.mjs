import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_STARTUP_REPATCH_AUDIT_V291.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.291 audit stays on the Ver.290 product baseline', () => {
  assert.equal(release, 267);
  assert.equal(String(responsibilities.baselineRelease), '267');
});

test('Ver.291 audit targets only the two startup insurance repatches', () => {
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /const schedulePatch = \(\) =>/);
  assert.match(shell, /setTimeout\(schedulePatch, 300\);/);
  assert.match(shell, /setTimeout\(schedulePatch, 1000\);/);

  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(shell, /window\.addEventListener\("orientationchange", \(\) => setTimeout\(schedulePatch, 150\)\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\);/);
  assert.match(shell, /setTimeout\(tryOpen, 220\);/);
  assert.match(shell, /setTimeout\(tryOpen, 500\);/);
});

test('Ver.291 audit documentation keeps production and write paths unchanged', () => {
  assert.match(audit, /audit-only/i);
  assert.match(audit, /temporary copy of `mobile-shell-v234\.js`/);
  assert.match(audit, /only the two startup `setTimeout\(schedulePatch, 300\/1000\)` calls suppressed/);
  assert.match(audit, /does \*\*not\*\* remove or suppress/);
  assert.match(audit, /`resize` recovery/);
  assert.match(audit, /`orientationchange` recovery/);
  assert.match(audit, /board-scoped MutationObserver/);
  assert.match(audit, /80ms \/ 220ms \/ 500ms retries/);
  assert.match(audit, /Firebase code and business-data write paths remain unchanged/);
});

test('Ver.291 responsibility candidate matches the startup-repatch audit scope', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.291監査/);
  assert.match(next.goal, /300ms\/1000ms固定再実行/);
  assert.match(next.precondition, /Ver\.290/);
});
