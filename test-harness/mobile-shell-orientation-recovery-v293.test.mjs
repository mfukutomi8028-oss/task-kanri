import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_ORIENTATION_RECOVERY_AUDIT_V293.md', 'utf8');
const retirement = readFileSync('MOBILE_SHELL_ORIENTATION_RECOVERY_RETIREMENT_V294.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.294+ product keeps release and responsibility baseline aligned after 269', () => {
  assert.ok(release >= 269);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.294 product keeps the audited delayed orientation recovery retired', () => {
  assert.match(shell, /function patchAll\(\)/);
  assert.match(shell, /const schedulePatch = \(\) =>/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.doesNotMatch(shell, /window\.addEventListener\("orientationchange"/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 150\)/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 300\)/);
  assert.doesNotMatch(shell, /setTimeout\(schedulePatch, 1000\)/);
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\)/);
  assert.match(shell, /setTimeout\(tryOpen, 220\)/);
  assert.match(shell, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.294 product keeps the Ver.293 evidence and explicit non-target boundaries', () => {
  assert.match(audit, /portrait -> landscape and landscape -> portrait device-metric transitions emit `resize`/);
  assert.match(audit, /orientationchange.*listener suppressed/);
  assert.match(audit, /mobile -> desktop-width -> mobile rotation-style transition/);
  assert.match(audit, /Ver\.294 may retire only the delayed orientation listener/);

  assert.match(retirement, /removes only this audited redundant recovery/);
  assert.match(retirement, /`resize -> schedulePatch -> patchAll\(\)` recovery/);
  assert.match(retirement, /`#boardView`-scoped MutationObserver/);
  assert.match(retirement, /80ms \/ 220ms \/ 500ms retries/);
  assert.match(retirement, /Release manifest: 268 -> 269/);
  assert.match(retirement, /No Firebase, task persistence, workflow, notification, or other business-data write path is changed/);
});

test('Ver.294 history remains durable while later resize cleanup advances independently', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.293監査/);
  assert.match(group.reason, /Ver\.294製品/);
  assert.match(group.reason, /orientationchange/);
  assert.match(group.reason, /release 269/);
  assert.match(group.reason, /Ver\.295監査/);
  assert.match(group.reason, /Ver\.296製品化ゲート/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  if (release === 269) {
    assert.match(next.goal, /Ver\.297監査/);
    assert.match(next.precondition, /Ver\.296/);
  } else {
    assert.match(group.reason, /Ver\.297監査/);
    assert.match(group.reason, /Ver\.298製品/);
    assert.match(next.goal, /Ver\.299監査/);
    assert.match(next.precondition, /Ver\.298/);
  }
});
