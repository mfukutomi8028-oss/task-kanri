import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_STARTUP_REPATCH_AUDIT_V291.md', 'utf8');
const retirement = readFileSync('MOBILE_SHELL_STARTUP_REPATCH_RETIREMENT_V292.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.292 product advances release and responsibility baseline to 268', () => {
  assert.equal(release, 268);
  assert.equal(String(responsibilities.baselineRelease), '268');
});

test('Ver.292 product retires only the two audited startup insurance repatches', () => {
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /const schedulePatch = \(\) =>/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 300\);/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 1000\);/);

  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(shell, /window\.addEventListener\("orientationchange", \(\) => setTimeout\(schedulePatch, 150\)\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\);/);
  assert.match(shell, /setTimeout\(tryOpen, 220\);/);
  assert.match(shell, /setTimeout\(tryOpen, 500\);/);
});

test('Ver.292 product keeps the Ver.291 evidence and explicit non-target boundaries', () => {
  assert.match(audit, /No tested behavior required a delayed full-shell `patchAll\(\)` at 300ms or 1000ms/);
  assert.match(audit, /Protocol and release-contract tests: success/);
  assert.match(audit, /Browser regression smoke tests: success/);
  assert.match(audit, /Firebase Emulator write tests: success/);

  assert.match(retirement, /Only these two fixed startup insurance calls are removed/);
  assert.match(retirement, /`resize` -> `schedulePatch` recovery/);
  assert.match(retirement, /`orientationchange` -> delayed `schedulePatch` recovery/);
  assert.match(retirement, /`#boardView`-scoped MutationObserver/);
  assert.match(retirement, /80ms \/ 220ms \/ 500ms retries/);
  assert.match(retirement, /Release manifest: 267 -> 268/);
  assert.match(retirement, /No Firebase, task persistence, workflow, notification, or other business-data write path is changed/);
});

test('Ver.292 responsibility ledger records productization and queues only a separate next audit', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.291監査/);
  assert.match(group.reason, /Ver\.292製品/);
  assert.match(group.reason, /300ms\/1000ms/);
  assert.match(group.reason, /release 268/);

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
