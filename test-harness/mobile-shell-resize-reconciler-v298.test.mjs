import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('mobile-shell-v234.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const product = readFileSync('MOBILE_SHELL_RESIZE_RECONCILER_V298.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.298 product advances release and responsibility baseline to 270', () => {
  assert.equal(release, 270);
  assert.equal(String(responsibilities.baselineRelease), '270');
});

test('Ver.298 product keeps startup patchAll at five responsibilities', () => {
  assert.match(shell, /function patchAll\(\) \{\s*ensureMobileHeader\(\);\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*bindGlobalClicks\(\);\s*\}/);
  assert.match(shell, /document\.addEventListener\("DOMContentLoaded", patchAll, \{ once: true \}\)/);
  assert.match(shell, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
});

test('Ver.298 product narrows only scheduled resize recovery to board title and menu', () => {
  assert.match(shell, /const schedulePatch = \(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\);[\s\S]*\};/);
  const scheduleBlock = shell.match(/const schedulePatch = \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.doesNotMatch(scheduleBlock, /ensureMobileHeader\(\)/);
  assert.doesNotMatch(scheduleBlock, /bindGlobalClicks\(\)/);
  assert.doesNotMatch(scheduleBlock, /patchAll\(\)/);
  assert.match(shell, /window\.addEventListener\("resize", schedulePatch\)/);
});

test('Ver.298 product preserves observer loader navigation and schedule-create boundaries', () => {
  assert.match(shell, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(shell, /event\.target\?\.closest\?\.\("\.nav-item"\)/);
  assert.match(shell, /setTimeout\(tryOpen, 80\)/);
  assert.match(shell, /setTimeout\(tryOpen, 220\)/);
  assert.match(shell, /setTimeout\(tryOpen, 500\)/);
  assert.match(product, /no Firebase, task persistence, workflow, notification, or other business-data write path is changed/i);
});

test('Ver.298 responsibility ledger records promotion and queues Ver.299 observer audit', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.297監査/);
  assert.match(group.reason, /Ver\.298製品/);
  assert.match(group.reason, /release 270/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['mobile-shell-v234.js']);
  assert.match(next.goal, /Ver\.299監査/);
  assert.match(next.goal, /MutationObserver/);
  assert.match(next.precondition, /Ver\.298/);
  assert.match(next.precondition, /270/);
});
