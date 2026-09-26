import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_RESIZE_RESPONSIBILITY_AUDIT_V297.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.297 audit keeps release 269 and production resize runtime unchanged', () => {
  assert.equal(release, 269);
  assert.equal(String(responsibilities.baselineRelease), '269');
  assert.match(shell, /function patchAll\(\) \{[\s\S]*ensureMobileHeader\(\);[\s\S]*patchMobileBoardTabs\(\);[\s\S]*syncMobileHeaderTitle\(\);[\s\S]*syncMobileMenuButton\(\);[\s\S]*bindGlobalClicks\(\);[\s\S]*\}/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.297 audit isolates the five patchAll responsibilities and proposed resize subset', () => {
  for (const name of ['ensureMobileHeader', 'patchMobileBoardTabs', 'syncMobileHeaderTitle', 'syncMobileMenuButton', 'bindGlobalClicks']) {
    assert.match(audit, new RegExp(`\\`${name}\\(\\)\\``));
  }
  assert.match(audit, /replaces its `patchAll\(\)` call/);
  assert.match(audit, /patchMobileBoardTabs\(\);[\s\S]*syncMobileHeaderTitle\(\);[\s\S]*syncMobileMenuButton\(\);/);
  assert.match(audit, /Startup `patchAll\(\)` must remain unchanged/);
});

test('Ver.297 audit preserves startup ownership and one-shot global click binding', () => {
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
  assert.match(shell, /window\.__workBoardMobileFixClicksV101 = true;/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
});

test('Ver.297 remains the queued audit after the Ver.296 gate', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.297監査/);
  assert.match(next.goal, /patchAll/);
  assert.match(next.precondition, /Ver\.296/);
  assert.match(next.precondition, /269/);
});
