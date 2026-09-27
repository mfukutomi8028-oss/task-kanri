import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.300 product advances release and responsibility baseline together', () => {
  assert.equal(release, 271);
  assert.equal(String(responsibilities.baselineRelease), '271');
});

test('Ver.300 product observes only direct child-list changes under boardView', () => {
  assert.match(mobile, /const boardView = document\.getElementById\("boardView"\)/);
  assert.match(mobile, /new MutationObserver\(scheduleBoardTabs\)\.observe\(boardView, \{ childList: true \}\)/);
  assert.doesNotMatch(mobile, /observe\(boardView, \{ childList: true, subtree: true \}\)/);
  assert.match(mobile, /function patchMobileBoardTabs\(\)/);
  assert.match(mobile, /const signature = columns\.map\(column => `\$\{getBoardColumnLabel\(column\)\}:\$\{column\.querySelectorAll\("\.task-card"\)\.length\}`\)\.join\("\|"\)/);
});

test('Ver.300 keeps observer targeting anchored to canonical app renderBoard replacement', () => {
  assert.match(app, /function renderBoard\(tasks\)/);
  assert.match(app, /elements\.boardView\.innerHTML = columns \+ addColumn/);
  assert.match(app, /bindTaskCards\(elements\.boardView\)/);
  assert.match(app, /bindBoardTaskDrops\(elements\.boardView\)/);
});

test('Ver.300 preserves Ver.298 resize reconciliation contract', () => {
  assert.match(mobile, /window\.addEventListener\("resize", schedulePatch\)/);
  assert.match(mobile, /requestAnimationFrame\(\(\) => \{\s*scheduled = false;\s*patchMobileBoardTabs\(\);\s*syncMobileHeaderTitle\(\);\s*syncMobileMenuButton\(\);\s*\}\)/);
  assert.doesNotMatch(mobile, /addEventListener\(["']orientationchange["']/);
});

test('Ver.300 records the promoted Ver.299 evidence and next audit boundary', () => {
  assert.match(audit, /unrelated descendant child-list mutation wakes the current subtree observer/);
  assert.match(audit, /direct-child candidate ignores that unrelated descendant mutation/);
  assert.match(audit, /real application board redraw still wakes the direct-child candidate/);

  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.match(group?.reason || '', /Ver\.299監査/);
  assert.match(group?.reason || '', /Ver\.300製品/);
  assert.match(group?.reason || '', /release 271/);

  const next = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(next?.scope, ['mobile-shell-v234.js']);
  assert.match(next?.goal || '', /Ver\.301監査/);
  assert.match(next?.precondition || '', /Ver\.300/);
});
