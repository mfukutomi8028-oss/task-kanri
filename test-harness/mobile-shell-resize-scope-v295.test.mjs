import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_RESIZE_SCOPE_AUDIT_V295.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.295 audit keeps production runtime and release 269 unchanged', () => {
  assert.equal(release, 269);
  assert.equal(String(responsibilities.baselineRelease), '269');
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.doesNotMatch(shell, /window\.addEventListener\("orientationchange"/);
});

test('Ver.295 audit documents the exact temporary resize-only substitution', () => {
  assert.match(audit, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(audit, /window\.addEventListener\("resize", scheduleBoardTabs\)/);
  assert.match(audit, /Production runtime remains unchanged/);
  assert.match(audit, /No Firebase or business-data write-path change/);
});

test('Ver.295 retains startup, observer, navigation, and schedule-create boundaries', () => {
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\)/);
  assert.match(shell, /setTimeout\(tryOpen, 220\)/);
  assert.match(shell, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.295 is the queued responsibility audit after Ver.294', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.295監査/);
  assert.match(next.goal, /resize/);
  assert.match(next.goal, /patchAll/);
  assert.match(next.precondition, /Ver\.294/);
  assert.match(next.precondition, /269/);
});
