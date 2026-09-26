import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_ORIENTATION_RECOVERY_AUDIT_V293.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.293 audit stays on the Ver.292 release boundary', () => {
  assert.equal(release, 268);
  assert.equal(String(responsibilities.baselineRelease), '268');
});

test('Ver.293 audit targets orientation recovery without changing the product runtime', () => {
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(shell, /window\.addEventListener\("orientationchange", \(\) => setTimeout\(schedulePatch, 150\)\)/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 300\)/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 1000\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\)/);
  assert.match(shell, /setTimeout\(tryOpen, 220\)/);
  assert.match(shell, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.293 audit documents the real rotation evidence and decision gate', () => {
  assert.match(audit, /portrait -> landscape and landscape -> portrait device-metric transitions emit `resize`/);
  assert.match(audit, /orientationchange.*listener suppressed/);
  assert.match(audit, /Mobile header\/title\/menu drift/);
  assert.match(audit, /mobile -> desktop-width -> mobile rotation-style transition/);
  assert.match(audit, /synthetic `orientationchange` dispatched without any viewport change is not treated as evidence/);
  assert.match(audit, /Ver\.294 may retire only the delayed orientation listener/);
});

test('Ver.293 matches the queued responsibility candidate', () => {
  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.293監査/);
  assert.match(next.goal, /orientationchange/);
  assert.match(next.goal, /resize/);
  assert.match(next.precondition, /Ver\.292/);
  assert.match(next.precondition, /268/);
});
