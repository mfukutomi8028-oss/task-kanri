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

test('Ver.291 audit documentation records the green evidence without changing production', () => {
  assert.match(audit, /audit-only/i);
  assert.match(audit, /temporary copy of `mobile-shell-v234\.js`/);
  assert.match(audit, /only the two startup `setTimeout\(schedulePatch, 300\/1000\)` calls suppressed/);
  assert.match(audit, /Regression #704/);
  assert.match(audit, /element is outside of the viewport/);
  assert.match(audit, /Regression #705/);
  assert.match(audit, /Protocol and release-contract tests: success/);
  assert.match(audit, /Browser regression smoke tests: success/);
  assert.match(audit, /Firebase Emulator write tests: success/);
  assert.match(audit, /No tested behavior required a delayed full-shell `patchAll\(\)` at 300ms or 1000ms/);
  assert.match(audit, /`resize` recovery/);
  assert.match(audit, /`orientationchange` recovery/);
  assert.match(audit, /board-scoped MutationObserver/);
  assert.match(audit, /80ms \/ 220ms \/ 500ms retries/);
  assert.match(audit, /remains release `267`/);
});

test('Ver.291 handoff queues only the audited timer removal for Ver.292 productization', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.291監査/);
  assert.match(group.reason, /300ms\/1000ms/);
  assert.match(group.reason, /Regression #705/);
  assert.match(group.reason, /Protocol・Browser・Firebase Emulatorすべてgreen/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.292製品化/);
  assert.match(next.goal, /300ms\/1000ms/);
  assert.match(next.goal, /2本だけを撤去/);
  assert.match(next.goal, /resize\/orientationchange補正/);
  assert.match(next.goal, /board-scoped MutationObserver/);
  assert.match(next.goal, /80\/220\/500ms retry/);
  assert.match(next.goal, /268/);
  assert.match(next.precondition, /Ver\.291監査PR/);
  assert.match(next.precondition, /267のまま一致/);
});
